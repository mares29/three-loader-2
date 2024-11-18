import {PointAttribute, PointAttributeTypes} from './point-attributes.ts';

const typedArrayMapping = {
    'int8':   Int8Array,
    'int16':  Int16Array,
    'int32':  Int32Array,
    'int64':  Float64Array,
    'uint8':  Uint8Array,
    'uint16': Uint16Array,
    'uint32': Uint32Array,
    'uint64': Float64Array,
    'float':  Float32Array,
    'double': Float64Array,
};

onmessage = function (event) {

	let {buffer, pointAttributes, scale, name, min, max, size, offset, numPoints} = event.data;

	let view = new DataView(buffer);

	let attributeBuffers = {};

	let bytesPerPointPosition = 4 * 3;
	let bytesPerPointColor = 4 * 3;

	let gridSize = 32;
	let grid = new Uint32Array(gridSize ** 3);
	let toIndex = (x, y, z) => {
		// min is already subtracted
		let dx = gridSize * x / size.x;
		let dy = gridSize * y / size.y;
		let dz = gridSize * z / size.z;

		let ix = Math.min(parseInt(dx), gridSize - 1);
		let iy = Math.min(parseInt(dy), gridSize - 1);
		let iz = Math.min(parseInt(dz), gridSize - 1);

		let index = ix + iy * gridSize + iz * gridSize * gridSize;

		return index;
	};

	let numOccupiedCells = 0;

    let tightBoxMin = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
    let tightBoxMax = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

	for (let pointAttribute of pointAttributes.attributes) {
		if(["POSITION_CARTESIAN", "position"].includes(pointAttribute.name)){
			let buff = new ArrayBuffer(numPoints * 4 * 3);
			let positions = new Float32Array(buff);
			for (let j = 0; j < numPoints; j++) {
				let pointOffset = j * bytesPerPointPosition;

				let x = view.getFloat32(pointOffset + 0, true) + offset[0] - min.x;
				let y = view.getFloat32(pointOffset + 4, true) + offset[1] - min.y;
				let z = view.getFloat32(pointOffset + 8, true) + offset[2] - min.z;

                tightBoxMin[0] = Math.min(tightBoxMin[0], x);
                tightBoxMin[1] = Math.min(tightBoxMin[1], y);
                tightBoxMin[2] = Math.min(tightBoxMin[2], z);

                tightBoxMax[0] = Math.max(tightBoxMax[0], x);
                tightBoxMax[1] = Math.max(tightBoxMax[1], y);
                tightBoxMax[2] = Math.max(tightBoxMax[2], z);

				let index = toIndex(x, y, z);
				let count = grid[index]++;
				if(count === 0){
					numOccupiedCells++;
				}

				positions[3 * j + 0] = x;
				positions[3 * j + 1] = y;
				positions[3 * j + 2] = z;
			}

			attributeBuffers[pointAttribute.name] = { buffer: buff, attribute: pointAttribute };
		}else if(["RGBA", "rgba", "sh_band_0"].includes(pointAttribute.name)){

			const SH_C0 = 0.28209479177387814;

			let bufferColors = new ArrayBuffer(numPoints * 4);
			let colors = new Uint8Array(bufferColors);
			for (let j = 0; j < numPoints; j++) {
				const c0 = 4 * j + 0;
				const c1 = 4 * j + 1;
				const c2 = 4 * j + 2;
				const c3 = 4 * j + 3;

				let pointOffset = j * bytesPerPointColor + numPoints * bytesPerPointPosition;

				let r = view.getFloat32(pointOffset + 0, true);
				let g = view.getFloat32(pointOffset + 4, true);
				let b = view.getFloat32(pointOffset + 8, true);

				colors[c0] = (0.5 + SH_C0 * r) * 255;
				colors[c1] = (0.5 + SH_C0 * g) * 255;
				colors[c2] = (0.5 + SH_C0 * b) * 255;

				const clamp = function(val, min, max) {
					return Math.max(Math.min(val, max), min);
				};

				colors[c0] = clamp(Math.floor(colors[c0]), 0, 255);
				colors[c1] = clamp(Math.floor(colors[c1]), 0, 255);
				colors[c2] = clamp(Math.floor(colors[c2]), 0, 255);
				colors[c3] = 255;
			}

			attributeBuffers['rgba'] = {
				buffer: bufferColors, attribute: pointAttribute};
		}
	}

	let occupancy = parseInt(numPoints / numOccupiedCells);

	{ // add indices
		let buff = new ArrayBuffer(numPoints * 4);
		let indices = new Uint32Array(buff);

		for (let i = 0; i < numPoints; i++) {
			indices[i] = i;
		}
		attributeBuffers["INDICES"] = { buffer: buff, attribute: PointAttribute.INDICES };
	}


	{ // handle attribute vectors
		let vectors = pointAttributes.vectors;

		for(let vector of vectors){

			let {name, attributes} = vector;
			let numVectorElements = attributes.length;
			let buffer = new ArrayBuffer(numVectorElements * numPoints * 4);
			let f32 = new Float32Array(buffer);

			let iElement = 0;
			for(let sourceName of attributes){
				let sourceBuffer = attributeBuffers[sourceName];
				let {offset, scale} = sourceBuffer;
				let view = new DataView(sourceBuffer.buffer);

				const getter = view.getFloat32.bind(view);

				for(let j = 0; j < numPoints; j++){
					let value = getter(j * 4, true);

					f32[j * numVectorElements + iElement] = (value / scale) + offset;
				}

				iElement++;
			}

			let vecAttribute = new PointAttribute(name, PointAttributeTypes.DATA_TYPE_FLOAT, 3);

			attributeBuffers[name] = { 
				buffer: buffer, 
				attribute: vecAttribute,
			};

		}

	}

	let message = {
		buffer: buffer,
		attributeBuffers: attributeBuffers,
		density: occupancy,
        tightBoundingBox: { min: tightBoxMin, max: tightBoxMax },
	};

	let transferables = [];
	for (let property in message.attributeBuffers) {
		transferables.push(message.attributeBuffers[property].buffer);
	}
	transferables.push(buffer);

	postMessage(message, transferables);
};
