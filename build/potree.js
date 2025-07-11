!(function (t, e) {
  'object' == typeof exports && 'object' == typeof module
    ? (module.exports = e(require('three')))
    : 'function' == typeof define && define.amd
      ? define('potree', ['three'], e)
      : 'object' == typeof exports
        ? (exports.potree = e(require('three')))
        : (t.potree = e(t.three));
})(self, (t) =>
  (() => {
    'use strict';
    var e = {
        29: (t, e, n) => {
          n.d(e, { A: () => i });
          const i =
            'precision highp float;\nprecision highp int;\n\n#define max_clip_boxes 30\n\nin vec3 position;\nin vec3 color;\n\n#ifdef color_rgba\n\tin vec4 rgba;\n#endif\n\nin vec3 normal;\nin float intensity;\nin float classification;\nin float returnNumber;\nin float numberOfReturns;\nin float pointSourceID;\nin vec4 indices;\nin vec2 uv;\n\nuniform mat4 modelMatrix;\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\nuniform mat4 viewMatrix;\nuniform mat3 normalMatrix;\n\nuniform float pcIndex;\n\nuniform float screenWidth;\nuniform float screenHeight;\nuniform float fov;\nuniform float spacing;\n\n#if defined use_clip_box\n\tuniform mat4 clipBoxes[max_clip_boxes];\n#endif\n\nuniform float heightMin;\nuniform float heightMax;\nuniform float size; // pixel size factor\nuniform float minSize; // minimum pixel size\nuniform float maxSize; // maximum pixel size\nuniform float octreeSize;\nuniform vec3 bbSize;\nuniform vec3 uColor;\nuniform float opacity;\nuniform float clipBoxCount;\nuniform float level;\nuniform float vnStart;\nuniform bool isLeafNode;\n\nuniform float filterByNormalThreshold;\nuniform vec2 intensityRange;\nuniform float opacityAttenuation;\nuniform float intensityGamma;\nuniform float intensityContrast;\nuniform float intensityBrightness;\nuniform float rgbGamma;\nuniform float rgbContrast;\nuniform float rgbBrightness;\nuniform float transition;\nuniform float wRGB;\nuniform float wIntensity;\nuniform float wElevation;\nuniform float wClassification;\nuniform float wReturnNumber;\nuniform float wSourceID;\n\nuniform bool renderDepth;\n\nuniform sampler2D visibleNodes;\nuniform sampler2D gradient;\nuniform sampler2D classificationLUT;\nuniform sampler2D depthMap;\n\n#ifdef use_texture_blending\n\tuniform sampler2D backgroundMap;\n#endif\n\n#ifdef use_point_cloud_mixing\n\tuniform int pointCloudMixingMode;\n\tuniform float pointCloudID;\n\n\tuniform float pointCloudMixAngle;\n\tuniform float stripeDistanceX;\n\tuniform float stripeDistanceY;\n\n\tuniform float stripeDivisorX;\n\tuniform float stripeDivisorY;\n#endif\n\n#ifdef highlight_point\n\tuniform vec3 highlightedPointCoordinate;\n\tuniform bool enablePointHighlighting;\n\tuniform float highlightedPointScale;\n#endif\n\n#ifdef use_filter_by_normal\n\tuniform int normalFilteringMode;\n#endif\n\nout vec3 vColor;\n\n#if !defined(color_type_point_index)\n\tout float vOpacity;\n#endif\n\n#if defined(weighted_splats)\n\tout float vLinearDepth;\n#endif\n\n#if !defined(paraboloid_point_shape) && defined(use_edl)\n\tout float vLogDepth;\n#endif\n\n#if defined(color_type_phong) && (MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0) || defined(paraboloid_point_shape)\n\tout vec3 vViewPosition;\n#endif\n\n#if defined(weighted_splats) || defined(paraboloid_point_shape)\n\tout float vRadius;\n#endif\n\n#if defined(color_type_phong) && (MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0)\n\tout vec3 vNormal;\n#endif\n\n#ifdef highlight_point\n\tout float vHighlight;\n#endif\n\n// ---------------------\n// OCTREE\n// ---------------------\n\n#if (defined(adaptive_point_size) || defined(color_type_lod)) && defined(tree_type_octree)\n\n/**\n * Rounds the specified number to the closest integer.\n */\nfloat safeRound(float number){\n\treturn floor(number + 0.5);\n}\n\n/**\n * Gets the number of 1-bits up to inclusive index position.\n *\n * number is treated as if it were an integer in the range 0-255\n */\nint numberOfOnes(int number, int index) {\n\tint numOnes = 0;\n\tint tmp = 128;\n\tfor (int i = 7; i >= 0; i--) {\n\n\t\tif (number >= tmp) {\n\t\t\tnumber = number - tmp;\n\n\t\t\tif (i <= index) {\n\t\t\t\tnumOnes++;\n\t\t\t}\n\t\t}\n\n\t\ttmp = tmp / 2;\n\t}\n\n\treturn numOnes;\n}\n\n/**\n * Checks whether the bit at index is 1.0\n *\n * number is treated as if it were an integer in the range 0-255\n */\nbool isBitSet(int number, int index){\n\n\t// weird multi else if due to lack of proper array, int and bitwise support in WebGL 1.0\n\tint powi = 1;\n\tif (index == 0) {\n\t\tpowi = 1;\n\t} else if (index == 1) {\n\t\tpowi = 2;\n\t} else if (index == 2) {\n\t\tpowi = 4;\n\t} else if (index == 3) {\n\t\tpowi = 8;\n\t} else if (index == 4) {\n\t\tpowi = 16;\n\t} else if (index == 5) {\n\t\tpowi = 32;\n\t} else if (index == 6) {\n\t\tpowi = 64;\n\t} else if (index == 7) {\n\t\tpowi = 128;\n\t}\n\n\tint ndp = number / powi;\n\n\treturn mod(float(ndp), 2.0) != 0.0;\n}\n\n/**\n * Gets the the LOD at the point position.\n */\nfloat getLOD() {\n\tvec3 offset = vec3(0.0, 0.0, 0.0);\n\tint iOffset = int(vnStart);\n\tfloat depth = level;\n\n\tfor (float i = 0.0; i <= 30.0; i++) {\n\t\tfloat nodeSizeAtLevel = octreeSize  / pow(2.0, i + level + 0.0);\n\n\t\tvec3 index3d = (position-offset) / nodeSizeAtLevel;\n\t\tindex3d = floor(index3d + 0.5);\n\t\tint index = int(safeRound(4.0 * index3d.x + 2.0 * index3d.y + index3d.z));\n\n\t\tvec4 value = texture(visibleNodes, vec2(float(iOffset) / 2048.0, 0.0));\n\t\tint mask = int(safeRound(value.r * 255.0));\n\n\t\tif (isBitSet(mask, index)) {\n\t\t\t// there are more visible child nodes at this position\n\t\t\tint advanceG = int(safeRound(value.g * 255.0)) * 256;\n\t\t\tint advanceB = int(safeRound(value.b * 255.0));\n\t\t\tint advanceChild = numberOfOnes(mask, index - 1);\n\t\t\tint advance = advanceG + advanceB + advanceChild;\n\n\t\t\tiOffset = iOffset + advance;\n\n\t\t\tdepth++;\n\t\t} else {\n\t\t\treturn value.a * 255.0; // no more visible child nodes at this position\n\t\t}\n\n\t\toffset = offset + (vec3(1.0, 1.0, 1.0) * nodeSizeAtLevel * 0.5) * index3d;\n\t}\n\n\treturn depth;\n}\n\nfloat getPointSizeAttenuation() {\n\treturn 0.5 * pow(2.0, getLOD());\n}\n\n#endif\n\n// ---------------------\n// KD-TREE\n// ---------------------\n\n#if (defined(adaptive_point_size) || defined(color_type_lod)) && defined(tree_type_kdtree)\n\nfloat getLOD() {\n\tvec3 offset = vec3(0.0, 0.0, 0.0);\n\tfloat intOffset = 0.0;\n\tfloat depth = 0.0;\n\n\tvec3 size = bbSize;\n\tvec3 pos = position;\n\n\tfor (float i = 0.0; i <= 1000.0; i++) {\n\n\t\tvec4 value = texture(visibleNodes, vec2(intOffset / 2048.0, 0.0));\n\n\t\tint children = int(value.r * 255.0);\n\t\tfloat next = value.g * 255.0;\n\t\tint split = int(value.b * 255.0);\n\n\t\tif (next == 0.0) {\n\t\t \treturn depth;\n\t\t}\n\n\t\tvec3 splitv = vec3(0.0, 0.0, 0.0);\n\t\tif (split == 1) {\n\t\t\tsplitv.x = 1.0;\n\t\t} else if (split == 2) {\n\t\t \tsplitv.y = 1.0;\n\t\t} else if (split == 4) {\n\t\t \tsplitv.z = 1.0;\n\t\t}\n\n\t\tintOffset = intOffset + next;\n\n\t\tfloat factor = length(pos * splitv / size);\n\t\tif (factor < 0.5) {\n\t\t \t// left\n\t\t\tif (children == 0 || children == 2) {\n\t\t\t\treturn depth;\n\t\t\t}\n\t\t} else {\n\t\t\t// right\n\t\t\tpos = pos - size * splitv * 0.5;\n\t\t\tif (children == 0 || children == 1) {\n\t\t\t\treturn depth;\n\t\t\t}\n\t\t\tif (children == 3) {\n\t\t\t\tintOffset = intOffset + 1.0;\n\t\t\t}\n\t\t}\n\t\tsize = size * ((1.0 - (splitv + 1.0) / 2.0) + 0.5);\n\n\t\tdepth++;\n\t}\n\n\n\treturn depth;\n}\n\nfloat getPointSizeAttenuation() {\n\treturn 0.5 * pow(1.3, getLOD());\n}\n\n#endif\n\n// formula adapted from: http://www.dfstudios.co.uk/articles/programming/image-programming-algorithms/image-processing-algorithms-part-5-contrast-adjustment/\nfloat getContrastFactor(float contrast) {\n\treturn (1.0158730158730156 * (contrast + 1.0)) / (1.0158730158730156 - contrast);\n}\n\nvec3 getRGB() {\n\t\n\t#ifdef color_rgba\n\t\tvec3 rgb = rgba.rgb;\n\t#else\t\n\t\tvec3 rgb = color;\n\t#endif\t\t\n\n\t#if defined(use_rgb_gamma_contrast_brightness)\n\t\trgb = pow(rgb, vec3(rgbGamma));\n\t\trgb = rgb + rgbBrightness;\n\t\trgb = (rgb - 0.5) * getContrastFactor(rgbContrast) + 0.5;\n\t\trgb = clamp(rgb, 0.0, 1.0);\n\t\treturn rgb;\n\t#else\n\t\treturn rgb;\n\t#endif\n}\n\nfloat getIntensity() {\n\tfloat w = (intensity - intensityRange.x) / (intensityRange.y - intensityRange.x);\n\tw = pow(w, intensityGamma);\n\tw = w + intensityBrightness;\n\tw = (w - 0.5) * getContrastFactor(intensityContrast) + 0.5;\n\tw = clamp(w, 0.0, 1.0);\n\n\treturn w;\n}\n\nvec3 getElevation() {\n\tvec4 world = modelMatrix * vec4( position, 1.0 );\n\tfloat w = (world.z - heightMin) / (heightMax-heightMin);\n\tvec3 cElevation = texture(gradient, vec2(w,1.0-w)).rgb;\n\n\treturn cElevation;\n}\n\nvec4 getClassification() {\n\tvec2 uv = vec2(classification / 255.0, 0.5);\n\tvec4 classColor = texture(classificationLUT, uv);\n\n\treturn classColor;\n}\n\nvec3 getReturnNumber() {\n\tif (numberOfReturns == 1.0) {\n\t\treturn vec3(1.0, 1.0, 0.0);\n\t} else {\n\t\tif (returnNumber == 1.0) {\n\t\t\treturn vec3(1.0, 0.0, 0.0);\n\t\t} else if (returnNumber == numberOfReturns) {\n\t\t\treturn vec3(0.0, 0.0, 1.0);\n\t\t} else {\n\t\t\treturn vec3(0.0, 1.0, 0.0);\n\t\t}\n\t}\n}\n\nvec3 getSourceID() {\n\tfloat w = mod(pointSourceID, 10.0) / 10.0;\n\treturn texture(gradient, vec2(w, 1.0 - w)).rgb;\n}\n\nvec3 getCompositeColor() {\n\tvec3 c;\n\tfloat w;\n\n\tc += wRGB * getRGB();\n\tw += wRGB;\n\n\tc += wIntensity * getIntensity() * vec3(1.0, 1.0, 1.0);\n\tw += wIntensity;\n\n\tc += wElevation * getElevation();\n\tw += wElevation;\n\n\tc += wReturnNumber * getReturnNumber();\n\tw += wReturnNumber;\n\n\tc += wSourceID * getSourceID();\n\tw += wSourceID;\n\n\tvec4 cl = wClassification * getClassification();\n\tc += cl.a * cl.rgb;\n\tw += wClassification * cl.a;\n\n\tc = c / w;\n\n\tif (w == 0.0) {\n\t\tgl_Position = vec4(100.0, 100.0, 100.0, 0.0);\n\t}\n\n\treturn c;\n}\n\nvoid main() {\n\tvec4 mvPosition = modelViewMatrix * vec4(position, 1.0);\n\n\tgl_Position = projectionMatrix * mvPosition;\n\n\t#if defined(color_type_phong) && (MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0) || defined(paraboloid_point_shape)\n\t\tvViewPosition = mvPosition.xyz;\n\t#endif\n\n\t#if defined weighted_splats\n\t\tvLinearDepth = gl_Position.w;\n\t#endif\n\n\t#if defined(color_type_phong) && (MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0)\n\t\tvNormal = normalize(normalMatrix * normal);\n\t#endif\n\n\t#if !defined(paraboloid_point_shape) && defined(use_edl)\n\t\tvLogDepth = log2(-mvPosition.z);\n\t#endif\n\n\t// ---------------------\n\t// POINT SIZE\n\t// ---------------------\n\n\tfloat pointSize = 1.0;\n\tfloat slope = tan(fov / 2.0);\n\tfloat projFactor =  -0.5 * screenHeight / (slope * mvPosition.z);\n\n\t#if defined fixed_point_size\n\t\tpointSize = size;\n\t#elif defined attenuated_point_size\n\t\tpointSize = size * spacing * projFactor;\n\t#elif defined adaptive_point_size\n\t\tfloat worldSpaceSize = 2.0 * size * spacing / getPointSizeAttenuation();\n\t\tpointSize = worldSpaceSize * projFactor;\n\t#endif\n\n\tpointSize = max(minSize, pointSize);\n\tpointSize = min(maxSize, pointSize);\n\n\t#if defined(weighted_splats) || defined(paraboloid_point_shape)\n\t\tvRadius = pointSize / projFactor;\n\t#endif\n\n\tgl_PointSize = pointSize;\n\n\t// ---------------------\n\t// HIGHLIGHTING\n\t// ---------------------\n\n\t#ifdef highlight_point\n\t\tvec4 mPosition = modelMatrix * vec4(position, 1.0);\n\t\tif (enablePointHighlighting && abs(mPosition.x - highlightedPointCoordinate.x) < 0.0001 &&\n\t\t\tabs(mPosition.y - highlightedPointCoordinate.y) < 0.0001 &&\n\t\t\tabs(mPosition.z - highlightedPointCoordinate.z) < 0.0001) {\n\t\t\tvHighlight = 1.0;\n\t\t\tgl_PointSize = pointSize * highlightedPointScale;\n\t\t} else {\n\t\t\tvHighlight = 0.0;\n\t\t}\n\t#endif\n\n\t// ---------------------\n\t// OPACITY\n\t// ---------------------\n\n\t#ifndef color_type_point_index\n\t\t#ifdef attenuated_opacity\n\t\t\tvOpacity = opacity * exp(-length(-mvPosition.xyz) / opacityAttenuation);\n\t\t#else\n\t\t\tvOpacity = opacity;\n\t\t#endif\n\t#endif\n\n\t// ---------------------\n\t// FILTERING\n\t// ---------------------\n\n\t#ifdef use_filter_by_normal\n\t\tbool discardPoint = false;\n\t\t// Absolute normal filtering\n\t\tif (normalFilteringMode == 1) {\n\t\t\tdiscardPoint = (abs((modelViewMatrix * vec4(normal, 0.0)).z) > filterByNormalThreshold);\n\t\t}\n\t\t// less than equal to\n\t\telse if (normalFilteringMode == 2) {\n\t\t\tdiscardPoint = (modelViewMatrix * vec4(normal, 0.0)).z <= filterByNormalThreshold;\n\t\t\t}\n\t\t// greater than\n\t\telse if(normalFilteringMode == 3) {\n\t\t\tdiscardPoint = (modelViewMatrix * vec4(normal, 0.0)).z > filterByNormalThreshold;\n\t\t\t}\n\n\t\tif (discardPoint)\n\t\t{\n\t\t\tgl_Position = vec4(0.0, 0.0, 2.0, 1.0);\n\t\t}\n\t#endif\n\n\t// ---------------------\n\t// POINT COLOR\n\t// ---------------------\n\n\t#ifdef color_type_rgb\n\t\tvColor = getRGB();\n\t#elif defined color_type_height\n\t\tvColor = getElevation();\n\t#elif defined color_type_rgb_height\n\t\tvec3 cHeight = getElevation();\n\t\tvColor = (1.0 - transition) * getRGB() + transition * cHeight;\n\t#elif defined color_type_depth\n\t\tfloat linearDepth = -mvPosition.z ;\n\t\tfloat expDepth = (gl_Position.z / gl_Position.w) * 0.5 + 0.5;\n\t\tvColor = vec3(linearDepth, expDepth, 0.0);\n\t#elif defined color_type_intensity\n\t\tfloat w = getIntensity();\n\t\tvColor = vec3(w, w, w);\n\t#elif defined color_type_intensity_gradient\n\t\tfloat w = getIntensity();\n\t\tvColor = texture(gradient, vec2(w, 1.0 - w)).rgb;\n\t#elif defined color_type_color\n\t\tvColor = uColor;\n\t#elif defined color_type_lod\n\tfloat w = getLOD() / 10.0;\n\tvColor = texture(gradient, vec2(w, 1.0 - w)).rgb;\n\t#elif defined color_type_point_index\n\t\tvColor = indices.rgb;\n\t#elif defined color_type_classification\n\t  vec4 cl = getClassification();\n\t\tvColor = cl.rgb;\n\t#elif defined color_type_return_number\n\t\tvColor = getReturnNumber();\n\t#elif defined color_type_source\n\t\tvColor = getSourceID();\n\t#elif defined color_type_normal\n\t\tvColor = (modelMatrix * vec4(normal, 0.0)).xyz;\n\t#elif defined color_type_phong\n\t\tvColor = color;\n\t#elif defined color_type_composite\n\t\tvColor = getCompositeColor();\n\t#endif\n\n\t#if !defined color_type_composite && defined color_type_classification\n\t\tif (cl.a == 0.0) {\n\t\t\tgl_Position = vec4(100.0, 100.0, 100.0, 0.0);\n\t\t\treturn;\n\t\t}\n\t#endif\n\n\t// ---------------------\n\t// CLIPPING\n\t// ---------------------\n\n\t#if defined use_clip_box\n\t\tbool insideAny = false;\n\t\tfor (int i = 0; i < max_clip_boxes; i++) {\n\t\t\tif (i == int(clipBoxCount)) {\n\t\t\t\tbreak;\n\t\t\t}\n\n\t\t\tvec4 clipPosition = clipBoxes[i] * modelMatrix * vec4(position, 1.0);\n\t\t\tbool inside = -0.5 <= clipPosition.x && clipPosition.x <= 0.5;\n\t\t\tinside = inside && -0.5 <= clipPosition.y && clipPosition.y <= 0.5;\n\t\t\tinside = inside && -0.5 <= clipPosition.z && clipPosition.z <= 0.5;\n\t\t\tinsideAny = insideAny || inside;\n\t\t}\n\n\t\tif (!insideAny) {\n\t\t\t#if defined clip_outside\n\t\t\t\tgl_Position = vec4(1000.0, 1000.0, 1000.0, 1.0);\n\t\t\t#elif defined clip_highlight_inside && !defined(color_type_depth)\n\t\t\t\tfloat c = (vColor.r + vColor.g + vColor.b) / 6.0;\n\t\t\t#endif\n\t\t} else {\n\t\t\t#if defined clip_highlight_inside\n\t\t\t\tvColor.r += 0.5;\n\t\t\t#elif defined clip_inside\n\t\t\t\tgl_Position = vec4(1000.0, 1000.0, 1000.0, 1.0);\n\t\t\t#endif\n\t\t}\n\t#endif\n\n\n\t// ---------------------\n\t// For Depth purposes\n\t// ---------------------\n\n\tif(renderDepth) {\n\t\tvColor = vec3(1. - gl_Position.z / gl_Position.w);\n\t}\n\n}\n';
        },
        30: (t, e, n) => {
          n.d(e, { A: () => o });
          var i = n(931),
            r = n.n(i);
          function o() {
            return r()(
              '(()=>{"use strict";const t={DATA_TYPE_DOUBLE:{ordinal:0,name:"double",size:8},DATA_TYPE_FLOAT:{ordinal:1,name:"float",size:4},DATA_TYPE_INT8:{ordinal:2,name:"int8",size:1},DATA_TYPE_UINT8:{ordinal:3,name:"uint8",size:1},DATA_TYPE_INT16:{ordinal:4,name:"int16",size:2},DATA_TYPE_UINT16:{ordinal:5,name:"uint16",size:2},DATA_TYPE_INT32:{ordinal:6,name:"int32",size:4},DATA_TYPE_UINT32:{ordinal:7,name:"uint32",size:4},DATA_TYPE_INT64:{ordinal:8,name:"int64",size:8},DATA_TYPE_UINT64:{ordinal:9,name:"uint64",size:8}};let e=0;for(const n in t)t[e]=t[n],e++;class n{constructor(t,e,n,r=[1/0,-1/0],a=void 0){this.name=t,this.type=e,this.numElements=n,this.range=r,this.uri=a,this.byteSize=this.numElements*this.type.size,this.description=""}}function r(t,e){return function(t){if(Array.isArray(t))return t}(t)||function(t,e){var n=null==t?null:"undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(null!=n){var r,a,i,o,u=[],A=!0,f=!1;try{if(i=(n=n.call(t)).next,0===e){if(Object(n)!==n)return;A=!1}else for(;!(A=(r=i.call(n)).done)&&(u.push(r.value),u.length!==e);A=!0);}catch(t){f=!0,a=t}finally{try{if(!A&&null!=n.return&&(o=n.return(),Object(o)!==o))return}finally{if(f)throw a}}return u}}(t,e)||i(t,e)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function a(t,e){var n="undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(!n){if(Array.isArray(t)||(n=i(t))||e&&t&&"number"==typeof t.length){n&&(t=n);var r=0,a=function(){};return{s:a,n:function(){return r>=t.length?{done:!0}:{done:!1,value:t[r++]}},e:function(t){throw t},f:a}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var o,u=!0,A=!1;return{s:function(){n=n.call(t)},n:function(){var t=n.next();return u=t.done,t},e:function(t){A=!0,o=t},f:function(){try{u||null==n.return||n.return()}finally{if(A)throw o}}}}function i(t,e){if(t){if("string"==typeof t)return o(t,e);var n={}.toString.call(t).slice(8,-1);return"Object"===n&&t.constructor&&(n=t.constructor.name),"Map"===n||"Set"===n?Array.from(t):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?o(t,e):void 0}}function o(t,e){(null==e||e>t.length)&&(e=t.length);for(var n=0,r=Array(e);n<e;n++)r[n]=t[n];return r}new n("POSITION_CARTESIAN",t.DATA_TYPE_FLOAT,3),new n("COLOR_PACKED",t.DATA_TYPE_INT8,4),new n("COLOR_PACKED",t.DATA_TYPE_INT8,4),new n("COLOR_PACKED",t.DATA_TYPE_INT8,3),new n("NORMAL_FLOATS",t.DATA_TYPE_FLOAT,3),new n("INTENSITY",t.DATA_TYPE_UINT16,1),new n("CLASSIFICATION",t.DATA_TYPE_UINT8,1),new n("NORMAL_SPHEREMAPPED",t.DATA_TYPE_UINT8,2),new n("NORMAL_OCT16",t.DATA_TYPE_UINT8,2),new n("NORMAL",t.DATA_TYPE_FLOAT,3),new n("RETURN_NUMBER",t.DATA_TYPE_UINT8,1),new n("NUMBER_OF_RETURNS",t.DATA_TYPE_UINT8,1),new n("SOURCE_ID",t.DATA_TYPE_UINT16,1),new n("INDICES",t.DATA_TYPE_UINT32,1),new n("SPACING",t.DATA_TYPE_FLOAT,1),new n("GPS_TIME",t.DATA_TYPE_DOUBLE,1);var u={int8:Int8Array,int16:Int16Array,int32:Int32Array,int64:Float64Array,uint8:Uint8Array,uint16:Uint16Array,uint32:Uint32Array,uint64:Float64Array,float:Float32Array,double:Float64Array};onmessage=function(e){var i,o=e.data,A=o.buffer,f=o.pointAttributes,T=o.scale,l=(o.name,o.min),s=(o.max,o.size),I=o.offset,_=o.numPoints,y=new DataView(A),m={},E=0,N=0,c=a(f.attributes);try{for(c.s();!(i=c.n()).done;)N+=i.value.byteSize}catch(t){c.e(t)}finally{c.f()}var b,d=32,h=new Uint32Array(Math.pow(d,3)),v=function(t,e,n){var r=d*t/s.x,a=d*e/s.y,i=d*n/s.z,o=Math.min(parseInt(r),31),u=Math.min(parseInt(a),31),A=Math.min(parseInt(i),31);return o+u*d+A*d*d},w=0,P=[Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY],D=[Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY],Y=a(f.attributes);try{for(Y.s();!(b=Y.n()).done;){var O=b.value;if(["POSITION_CARTESIAN","position"].includes(O.name)){for(var U=new ArrayBuffer(4*_*3),g=new Float32Array(U),S=0;S<_;S++){var p=S*N,F=y.getInt32(p+E+0,!0)*T[0]+I[0]-l.x,M=y.getInt32(p+E+4,!0)*T[1]+I[1]-l.y,z=y.getInt32(p+E+8,!0)*T[2]+I[2]-l.z;P[0]=Math.min(P[0],F),P[1]=Math.min(P[1],M),P[2]=Math.min(P[2],z),D[0]=Math.max(D[0],F),D[1]=Math.max(D[1],M),D[2]=Math.max(D[2],z),0===h[v(F,M,z)]++&&w++,g[3*S+0]=F,g[3*S+1]=M,g[3*S+2]=z}m[O.name]={buffer:U,attribute:O}}else if(["RGBA","rgba"].includes(O.name)){for(var R=new ArrayBuffer(4*_),C=new Uint8Array(R),L=0;L<_;L++){var B=L*N,x=y.getUint16(B+E+0,!0),V=y.getUint16(B+E+2,!0),G=y.getUint16(B+E+4,!0);C[4*L+0]=x>255?x/256:x,C[4*L+1]=V>255?V/256:V,C[4*L+2]=G>255?G/256:G}m[O.name]={buffer:R,attribute:O}}else{var j=new ArrayBuffer(4*_),K=new Float32Array(j),H=new(0,u[O.type.name])(_),$=0,k=1,q={int8:y.getInt8,int16:y.getInt16,int32:y.getInt32,uint8:y.getUint8,uint16:y.getUint16,uint32:y.getUint32,float:y.getFloat32,double:y.getFloat64}[O.type.name].bind(y);if(O.type.size>4){var J=r(O.range,2),Q=J[0],W=J[1];$=Q,k=1/(W-Q)}for(var X=0;X<_;X++){var Z=q(X*N+E,!0);K[X]=(Z-$)*k,H[X]=Z}m[O.name]={buffer:j,preciseBuffer:H,attribute:O,offset:$,scale:k}}E+=O.byteSize}}catch(t){Y.e(t)}finally{Y.f()}for(var tt=parseInt(_/w),et=new ArrayBuffer(4*_),nt=new Uint32Array(et),rt=0;rt<_;rt++)nt[rt]=rt;m.INDICES={buffer:et,attribute:n.INDICES};var at,it=a(f.vectors);try{for(it.s();!(at=it.n()).done;){var ot,ut=at.value,At=ut.name,ft=ut.attributes,Tt=ft.length,lt=new ArrayBuffer(Tt*_*4),st=new Float32Array(lt),It=0,_t=a(ft);try{for(_t.s();!(ot=_t.n()).done;){for(var yt=m[ot.value],mt=yt.offset,Et=yt.scale,Nt=new DataView(yt.buffer),ct=Nt.getFloat32.bind(Nt),bt=0;bt<_;bt++){var dt=ct(4*bt,!0);st[bt*Tt+It]=dt/Et+mt}It++}}catch(t){_t.e(t)}finally{_t.f()}var ht=new n(At,t.DATA_TYPE_FLOAT,3);m[At]={buffer:lt,attribute:ht}}}catch(t){it.e(t)}finally{it.f()}var vt={buffer:A,attributeBuffers:m,density:tt,tightBoundingBox:{min:P,max:D}},wt=[];for(var Pt in vt.attributeBuffers)wt.push(vt.attributeBuffers[Pt].buffer);wt.push(A),postMessage(vt,wt)}})();\n',
              'Worker',
              void 0,
              void 0,
            );
          }
        },
        46: (t, e, n) => {
          (n.r(e), n.d(e, { default: () => i }));
          const i =
            'precision highp float;\nprecision highp int;\n\nuniform mat4 projectionMatrix;\n\nuniform float screenWidth;\nuniform float screenHeight;\n\nuniform sampler2D map;\n\nvarying vec2 vUv;\n\nvoid main() {\n\n\tfloat dx = 1.0 / screenWidth;\n\tfloat dy = 1.0 / screenHeight;\n\n\tvec3 color = vec3(0.0, 0.0, 0.0);\n\tcolor += texture2D(map, vUv + vec2(-dx, -dy)).rgb;\n\tcolor += texture2D(map, vUv + vec2(  0, -dy)).rgb;\n\tcolor += texture2D(map, vUv + vec2(+dx, -dy)).rgb;\n\tcolor += texture2D(map, vUv + vec2(-dx,   0)).rgb;\n\tcolor += texture2D(map, vUv + vec2(  0,   0)).rgb;\n\tcolor += texture2D(map, vUv + vec2(+dx,   0)).rgb;\n\tcolor += texture2D(map, vUv + vec2(-dx,  dy)).rgb;\n\tcolor += texture2D(map, vUv + vec2(  0,  dy)).rgb;\n\tcolor += texture2D(map, vUv + vec2(+dx,  dy)).rgb;\n    \n\tcolor = color / 9.0;\n\t\n\tgl_FragColor = vec4(color, 1.0);\n\t\n\t\n}';
        },
        57: (t, e, n) => {
          n.d(e, { A: () => o });
          var i = n(931),
            r = n.n(i);
          function o() {
            return r()(
              '(()=>{"use strict";var t;!function(t){t[t.POSITION_CARTESIAN=0]="POSITION_CARTESIAN",t[t.COLOR_PACKED=1]="COLOR_PACKED",t[t.COLOR_FLOATS_1=2]="COLOR_FLOATS_1",t[t.COLOR_FLOATS_255=3]="COLOR_FLOATS_255",t[t.NORMAL_FLOATS=4]="NORMAL_FLOATS",t[t.FILLER=5]="FILLER",t[t.INTENSITY=6]="INTENSITY",t[t.CLASSIFICATION=7]="CLASSIFICATION",t[t.NORMAL_SPHEREMAPPED=8]="NORMAL_SPHEREMAPPED",t[t.NORMAL_OCT16=9]="NORMAL_OCT16",t[t.NORMAL=10]="NORMAL"}(t||(t={}));const e={ordinal:1,size:4},n={ordinal:2,size:1},r={ordinal:3,size:1};function i(t,e,n){return{name:t,type:e,numElements:n,byteSize:n*e.size}}const s=i(t.COLOR_PACKED,n,4),a={POSITION_CARTESIAN:i(t.POSITION_CARTESIAN,e,3),RGBA_PACKED:s,COLOR_PACKED:s,RGB_PACKED:i(t.COLOR_PACKED,n,3),NORMAL_FLOATS:i(t.NORMAL_FLOATS,e,3),FILLER_1B:i(t.FILLER,r,1),INTENSITY:i(t.INTENSITY,{ordinal:5,size:2},1),CLASSIFICATION:i(t.CLASSIFICATION,r,1),NORMAL_SPHEREMAPPED:i(t.NORMAL_SPHEREMAPPED,r,2),NORMAL_OCT16:i(t.NORMAL_OCT16,r,2),NORMAL:i(t.NORMAL,e,3)};class o{constructor(t){this.versionMinor=0,this.version=t;const e=-1===t.indexOf(".")?t.length:t.indexOf(".");this.versionMajor=parseInt(t.substr(0,e),10),this.versionMinor=parseInt(t.substr(e+1),10),isNaN(this.versionMinor)&&(this.versionMinor=0)}newerThan(t){const e=new o(t);return this.versionMajor>e.versionMajor||this.versionMajor===e.versionMajor&&this.versionMinor>e.versionMinor}equalOrHigher(t){const e=new o(t);return this.versionMajor>e.versionMajor||this.versionMajor===e.versionMajor&&this.versionMinor>=e.versionMinor}upTo(t){return!this.newerThan(t)}}class u{constructor(t){this.tmp=new ArrayBuffer(4),this.tmpf=new Float32Array(this.tmp),this.tmpu8=new Uint8Array(this.tmp),this.u8=new Uint8Array(t)}getUint32(t){return this.u8[t+3]<<24|this.u8[t+2]<<16|this.u8[t+1]<<8|this.u8[t]}getUint16(t){return this.u8[t+1]<<8|this.u8[t]}getFloat32(t){const e=this.tmpu8,n=this.u8,r=this.tmpf;return e[0]=n[t+0],e[1]=n[t+1],e[2]=n[t+2],e[3]=n[t+3],r[0]}getUint8(t){return this.u8[t]}}const f=Math.sign||function(t){return 0==(t=+t)||t!=t?t:t<0?-1:1};function A(e,n){const r=function(e,n){switch(e.name){case t.POSITION_CARTESIAN:return function(t,e){const n=new ArrayBuffer(4*e.numPoints*3),r=new Float32Array(n);for(let t=0;t<e.numPoints;t++){let n,i,s;e.version.newerThan("1.3")?(n=e.data.getUint32(e.currentOffset+t*e.pointAttributes.byteSize+0)*e.scale,i=e.data.getUint32(e.currentOffset+t*e.pointAttributes.byteSize+4)*e.scale,s=e.data.getUint32(e.currentOffset+t*e.pointAttributes.byteSize+8)*e.scale):(n=e.data.getFloat32(t*e.pointAttributes.byteSize+0)+e.nodeOffset[0],i=e.data.getFloat32(t*e.pointAttributes.byteSize+4)+e.nodeOffset[1],s=e.data.getFloat32(t*e.pointAttributes.byteSize+8)+e.nodeOffset[2]),r[3*t+0]=n,r[3*t+1]=i,r[3*t+2]=s,e.mean[0]+=n/e.numPoints,e.mean[1]+=i/e.numPoints,e.mean[2]+=s/e.numPoints,e.tightBoxMin[0]=Math.min(e.tightBoxMin[0],n),e.tightBoxMin[1]=Math.min(e.tightBoxMin[1],i),e.tightBoxMin[2]=Math.min(e.tightBoxMin[2],s),e.tightBoxMax[0]=Math.max(e.tightBoxMax[0],n),e.tightBoxMax[1]=Math.max(e.tightBoxMax[1],i),e.tightBoxMax[2]=Math.max(e.tightBoxMax[2],s)}return{buffer:n,attribute:t}}(e,n);case t.COLOR_PACKED:return function(t,e){const n=new ArrayBuffer(3*e.numPoints),r=new Uint8Array(n);for(let t=0;t<e.numPoints;t++)r[3*t+0]=e.data.getUint8(e.currentOffset+t*e.pointAttributes.byteSize+0),r[3*t+1]=e.data.getUint8(e.currentOffset+t*e.pointAttributes.byteSize+1),r[3*t+2]=e.data.getUint8(e.currentOffset+t*e.pointAttributes.byteSize+2);return{buffer:n,attribute:t}}(e,n);case t.INTENSITY:return function(t,e){const n=new ArrayBuffer(4*e.numPoints),r=new Float32Array(n);for(let t=0;t<e.numPoints;t++)r[t]=e.data.getUint16(e.currentOffset+t*e.pointAttributes.byteSize);return{buffer:n,attribute:t}}(e,n);case t.CLASSIFICATION:return function(t,e){const n=new ArrayBuffer(e.numPoints),r=new Uint8Array(n);for(let t=0;t<e.numPoints;t++)r[t]=e.data.getUint8(e.currentOffset+t*e.pointAttributes.byteSize);return{buffer:n,attribute:t}}(e,n);case t.NORMAL_SPHEREMAPPED:return function(t,e){const n=new ArrayBuffer(4*e.numPoints*3),r=new Float32Array(n);for(let t=0;t<e.numPoints;t++){let n=e.data.getUint8(e.currentOffset+t*e.pointAttributes.byteSize+0)/255*2-1,i=e.data.getUint8(e.currentOffset+t*e.pointAttributes.byteSize+1)/255*2-1,s=1;const a=n*-n+i*-i+1*s;s=a,n*=Math.sqrt(a),i*=Math.sqrt(a),n*=2,i*=2,s=2*s-1,r[3*t+0]=n,r[3*t+1]=i,r[3*t+2]=s}return{buffer:n,attribute:t}}(e,n);case t.NORMAL_OCT16:return function(t,e){const n=new ArrayBuffer(4*e.numPoints*3),r=new Float32Array(n);for(let t=0;t<e.numPoints;t++){const n=e.data.getUint8(e.currentOffset+t*e.pointAttributes.byteSize+0)/255*2-1,i=e.data.getUint8(e.currentOffset+t*e.pointAttributes.byteSize+1)/255*2-1;let s=1-Math.abs(n)-Math.abs(i),a=0,o=0;s>=0?(a=n,o=i):(a=-(i/f(i)-1)/f(n),o=-(n/f(n)-1)/f(i));const u=Math.sqrt(a*a+o*o+s*s);a/=u,o/=u,s/=u,r[3*t+0]=a,r[3*t+1]=o,r[3*t+2]=s}return{buffer:n,attribute:t}}(e,n);case t.NORMAL:return function(t,e){const n=new ArrayBuffer(4*e.numPoints*3),r=new Float32Array(n);for(let t=0;t<e.numPoints;t++){const n=e.data.getFloat32(e.currentOffset+t*e.pointAttributes.byteSize+0),i=e.data.getFloat32(e.currentOffset+t*e.pointAttributes.byteSize+4),s=e.data.getFloat32(e.currentOffset+t*e.pointAttributes.byteSize+8);r[3*t+0]=n,r[3*t+1]=i,r[3*t+2]=s}return{buffer:n,attribute:t}}(e,n);default:return}}(e,n);void 0!==r&&(n.attributeBuffers[r.attribute.name]=r,n.transferables.push(r.buffer))}onmessage=function(e){const n=e.data.buffer,r=e.data.pointAttributes,i={attributeBuffers:{},currentOffset:0,data:new u(n),mean:[0,0,0],nodeOffset:e.data.offset,numPoints:e.data.buffer.byteLength/r.byteSize,pointAttributes:r,scale:e.data.scale,tightBoxMax:[Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY],tightBoxMin:[Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY],transferables:[],version:new o(e.data.version)};for(const t of i.pointAttributes.attributes)A(t,i),i.currentOffset+=t.byteSize;const s=new ArrayBuffer(4*i.numPoints),f=new Uint32Array(s);for(let t=0;t<i.numPoints;t++)f[t]=t;i.attributeBuffers[t.CLASSIFICATION]||function(e){const n=new ArrayBuffer(4*e.numPoints),r=new Float32Array(n);for(let t=0;t<e.numPoints;t++)r[t]=0;e.attributeBuffers[t.CLASSIFICATION]={buffer:n,attribute:a.CLASSIFICATION}}(i);const O={buffer:n,mean:i.mean,attributeBuffers:i.attributeBuffers,tightBoundingBox:{min:i.tightBoxMin,max:i.tightBoxMax},indices:s};postMessage(O,i.transferables)}})();\n',
              'Worker',
              void 0,
              void 0,
            );
          }
        },
        183: (t, e, n) => {
          (n.r(e), n.d(e, { default: () => i }));
          const i =
            'precision highp float;\nprecision highp int;\n\nattribute vec3 position;\nattribute vec2 uv;\n\nuniform mat4 modelViewMatrix;\nuniform mat4 projectionMatrix;\n\nvarying vec2 vUv;\n\nvoid main() {\n    vUv = uv;\n\n    gl_Position =   projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}';
        },
        391: (t, e, n) => {
          n.d(e, { A: () => i });
          const i =
            'precision highp float;\nprecision highp int;\n\nin int indexes_sorted;\n\nuniform vec2 focal;\nuniform float inverseFocalAdjustment;\nuniform float splatScale;\nuniform vec2 basisViewport;\nuniform float harmonicsDegree;\nuniform bool renderIds;\nuniform bool adaptiveSize;\n\nuniform sampler2D covarianceTexture0;\nuniform sampler2D covarianceTexture1;\nuniform sampler2D nodeTexture;\nuniform highp usampler2D posColorTexture;\nuniform highp usampler2D nodeIndicesTexture;\nuniform highp usampler2D harmonicsTexture1;\nuniform highp usampler2D harmonicsTexture2;\nuniform highp usampler2D harmonicsTexture3;\n\nuniform highp usampler2D nodeTexture2;\nuniform float fov;\nuniform float spacing;\nuniform float screenHeight;\nuniform float maxSplatScale;\n\n\nuniform bool renderOnlyHarmonics;\nuniform float harmonicsScale;\n\n//To read the LOD for each point\nuniform highp usampler2D vnStartTexture;\nuniform sampler2D visibleNodes;\nuniform float octreeSize;\n\nout vec3 vColor;\nout float vOpacity;\nout vec2 vPosition;\nout float vZ;\nout float backfaseCulling;\nout vec2 vID;\n\nconst float sqrt8 = sqrt(8.0);\nconst float minAlpha = 1.0 / 255.0;\n\n\nconst vec4 encodeNorm4 = vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0);\nconst uvec4 mask4 = uvec4(uint(0x000000FF), uint(0x0000FF00), uint(0x00FF0000), uint(0xFF000000));\nconst uvec4 shift4 = uvec4(0, 8, 16, 24);\nvec4 uintToRGBAVec (uint u) {\n    uvec4 urgba = mask4 & u;\n    urgba = urgba >> shift4;\n    vec4 rgba = vec4(urgba) * encodeNorm4;\n    return rgba;\n}\nvec3 unpack111011s(uint bits) { \n    vec3 result = vec3((uvec3(bits) >> uvec3(21u, 11u, 0u)) & uvec3(0x7ffu, 0x3ffu, 0x7ffu)) / vec3(2047.0, 1023.0, 2047.0); \n    return result * 2. - 1.;\n}       \nivec2 getDataUVSplat(in int stride, in int offset, in vec2 dimensions, in int index) {\n    ivec2 samplerUV = ivec2(0, 0);\n    float d = float(uint(index) * uint(stride) + uint(offset));\n    samplerUV.y = int(floor(d / dimensions.x));\n    samplerUV.x = int(mod(d, dimensions.x));\n    return samplerUV;\n}\n\nconst float SH_C1 = 0.4886025119029199f;\nconst float[5] SH_C2 = float[](1.0925484, -1.0925484, 0.3153916, -1.0925484, 0.5462742);\nconst float[7] SH_C3 = float[](-0.5900435899266435, \n                                2.890611442640554, \n                                -0.4570457994644658, \n                                0.3731763325901154, \n                                -0.4570457994644658, \n                                1.445305721320277, \n                                -0.5900435899266435);\n\n/**\n * Gets the number of 1-bits up to inclusive index position.\n *\n * number is treated as if it were an integer in the range 0-255\n */\nint numberOfOnes(int number, int index) {\n\tint numOnes = 0;\n\tint tmp = 128;\n\tfor (int i = 7; i >= 0; i--) {\n\n\t\tif (number >= tmp) {\n\t\t\tnumber = number - tmp;\n\n\t\t\tif (i <= index) {\n\t\t\t\tnumOnes++;\n\t\t\t}\n\t\t}\n\n\t\ttmp = tmp / 2;\n\t}\n\n\treturn numOnes;\n}\n\n/**\n * Checks whether the bit at index is 1.0\n *\n * number is treated as if it were an integer in the range 0-255\n */\nbool isBitSet(int number, int index){\n\n\t// weird multi else if due to lack of proper array, int and bitwise support in WebGL 1.0\n\tint powi = 1;\n\tif (index == 0) {\n\t\tpowi = 1;\n\t} else if (index == 1) {\n\t\tpowi = 2;\n\t} else if (index == 2) {\n\t\tpowi = 4;\n\t} else if (index == 3) {\n\t\tpowi = 8;\n\t} else if (index == 4) {\n\t\tpowi = 16;\n\t} else if (index == 5) {\n\t\tpowi = 32;\n\t} else if (index == 6) {\n\t\tpowi = 64;\n\t} else if (index == 7) {\n\t\tpowi = 128;\n\t}\n\n\tint ndp = number / powi;\n\n\treturn mod(float(ndp), 2.0) != 0.0;\n}\n\n/**\n * Gets the the LOD at the point position.\n */\nfloat getLOD(vec3 pos, int vnStart, float level) {\n\tvec3 offset = vec3(0.0, 0.0, 0.0);\n\tint iOffset = vnStart;\n\tfloat depth = level;\n\n\tfor (float i = 0.0; i <= 30.0; i++) {\n\t\tfloat nodeSizeAtLevel = octreeSize  / pow(2.0, i + level + 0.0);\n\n\t\tvec3 index3d = (pos-offset) / nodeSizeAtLevel;\n\t\tindex3d = floor(index3d + 0.5);\n\t\tint index = int(round(4.0 * index3d.x + 2.0 * index3d.y + index3d.z));\n\n\t\tvec4 value = texture2D(visibleNodes, vec2(float(iOffset) / 2048.0, 0.0));\n\t\tint mask = int(round(value.r * 255.0));\n\n\t\tif (isBitSet(mask, index)) {\n\t\t\t// there are more visible child nodes at this position\n\t\t\tint advanceG = int(round(value.g * 255.0)) * 256;\n\t\t\tint advanceB = int(round(value.b * 255.0));\n\t\t\tint advanceChild = numberOfOnes(mask, index - 1);\n\t\t\tint advance = advanceG + advanceB + advanceChild;\n\n\t\t\tiOffset = iOffset + advance;\n\n\t\t\tdepth++;\n\t\t} else {\n\t\t\treturn value.a * 255.0; // no more visible child nodes at this position\n\t\t}\n\n\t\toffset = offset + (vec3(1.0, 1.0, 1.0) * nodeSizeAtLevel * 0.5) * index3d;\n\t}\n\n\treturn depth;\n}\n\nfloat getPointSizeAttenuation(vec3 pos, int vnStart, float level) {\n    return 0.5 * pow(2.0, getLOD(pos, vnStart, level));\n}\n\n\nvoid main() {\n\n    ivec2 samplerUV = ivec2(0, 0);\n    vec2 dim = vec2(textureSize(covarianceTexture0, 0).xy);\n    float dd = float(indexes_sorted);\n    samplerUV.y = int(floor(dd / dim.x));\n    samplerUV.x = int(mod(dd, dim.x));\n\n    vec4 cov3D_4 = texelFetch(covarianceTexture0, samplerUV, 0);\n    vec2 cov3D_2 = texelFetch(covarianceTexture1, samplerUV, 0).rg;\n\n\n    uvec4 sampledCenterColor = texelFetch(posColorTexture, samplerUV, 0);\n    vec3 instancePosition = uintBitsToFloat(uvec3(sampledCenterColor.gba));\n\n    uint nodeIndex = texelFetch(nodeIndicesTexture, samplerUV, 0).r;\n\n\n    vID = vec2(indexes_sorted, nodeIndex);\n\n    samplerUV = ivec2(0, 0);\n    dd = float(nodeIndex);\n    samplerUV.y = int(floor(dd / 100.));\n    samplerUV.x = int(mod(dd, 100.));\n\n    vec4 nodeData = texelFetch(nodeTexture, samplerUV, 0);\n\n    ivec2 levelAndVnStart =  ivec2(texelFetch(nodeTexture2, samplerUV, 0).rg);\n    int vnStart = levelAndVnStart.r;\n    int level = levelAndVnStart.g;\n\n    instancePosition += nodeData.rgb;\n\n    vec4 viewCenter = modelViewMatrix * vec4(instancePosition, 1.0);\n    vec4 clipCenter = projectionMatrix * viewCenter;\n    vec3 ndcCenter = clipCenter.xyz / clipCenter.w;\n\n    mat3 Vrk = mat3(\n        cov3D_4.x, cov3D_4.y, cov3D_4.z,\n        cov3D_4.y, cov3D_4.w, cov3D_2.x,\n        cov3D_4.z, cov3D_2.x, cov3D_2.y\n    );\n\n    mat3 J;\n    float s = 1.0 / (viewCenter.z * viewCenter.z);\n    J = mat3(\n        focal.x / viewCenter.z, 0., -(focal.x * viewCenter.x) * s,\n        0., focal.y / viewCenter.z, -(focal.y * viewCenter.y) * s,\n        0., 0., 0.\n    );\n\n    mat3 W = transpose(mat3(modelViewMatrix));\n    mat3 T = W * J;\n\n    mat3 cov2Dm = transpose(T) * Vrk * T;\n    cov2Dm[0][0] += 0.3;\n    cov2Dm[1][1] += 0.3;\n\n    vec3 cov2Dv = vec3(cov2Dm[0][0], cov2Dm[0][1], cov2Dm[1][1]);\n\n    float a = cov2Dv.x;\n    float d = cov2Dv.z;\n    float b = cov2Dv.y;\n    float D = a * d - b * b;\n    float trace = a + d;\n    float traceOver2 = 0.5 * trace;\n    float term2 = sqrt(max(0.1f, traceOver2 * traceOver2 - D));\n    float eigenValue1 = traceOver2 + term2;\n    float eigenValue2 = traceOver2 - term2;\n\n    if (eigenValue2 <= 0.0) return;\n\n    vec2 eigenVector1 = normalize(vec2(b, eigenValue1 - a));\n    // since the eigen vectors are orthogonal, we derive the second one from the first\n    vec2 eigenVector2 = vec2(eigenVector1.y, -eigenVector1.x);\n\n    //Get the adaptive size\n    float renderScale = 1.;\n\n    if(adaptiveSize) {\n\n        float slope = tan(fov / 2.0);\n\t    float projFactor =  -0.5 * screenHeight / (slope * viewCenter.z);\n        float worldSpaceSize = 2.0 * spacing / getPointSizeAttenuation( instancePosition, vnStart, float(level) );\n        renderScale = worldSpaceSize * projFactor;\n\n        //the splats should be at least the default size.\n        renderScale = max(1., renderScale);\n        renderScale = min(renderScale, maxSplatScale);\n\n    }\n\n    float cameraDistance = length(cameraPosition - instancePosition);\n\n    // We use sqrt(8) standard deviations instead of 3 to eliminate more of the splat with a very low opacity.\n    vec2 basisVector1 = eigenVector1 * renderScale * min(sqrt8 * sqrt(eigenValue1), 1024.);\n    vec2 basisVector2 = eigenVector2 * renderScale * min(sqrt8 * sqrt(eigenValue2), 1024.);\n\n    vec2 ndcOffset = vec2(position.x * basisVector1 + position.y * basisVector2) *\n                        basisViewport * 2.0 * inverseFocalAdjustment;\n\n    vec4 quadPos = vec4(ndcCenter.xy + ndcOffset, ndcCenter.z, 1.0);\n    vZ = ndcCenter.z;\n    gl_Position = quadPos;\n\n    vPosition = position.xy;\n    vPosition *= sqrt8;\n\n    vec4 colorData = uintToRGBAVec(sampledCenterColor.r);\n\n    vColor = colorData.rgb;\n\n    vec3 worldViewDir = normalize(instancePosition - cameraPosition);\n\n    //Harmonics\n    vec3 harmonics = vec3(0.);\n    vec3 sh1 = vec3(0.);\n    vec3 sh2 = vec3(0.);\n    vec3 sh3 = vec3(0.);\n\n    vec3 sh4 = vec3(0.);\n    vec3 sh5 = vec3(0.);\n    vec3 sh6 = vec3(0.);\n    vec3 sh7 = vec3(0.);\n    vec3 sh8 = vec3(0.);\n\n    vec3 sh9 = vec3(0.);\n    vec3 sh10 = vec3(0.);\n    vec3 sh11 = vec3(0.);\n    vec3 sh12 = vec3(0.);\n    vec3 sh13 = vec3(0.);\n    vec3 sh14 = vec3(0.);\n    vec3 sh15 = vec3(0.);\n\n    if(harmonicsDegree > 0. && !renderIds) {\n\n        vec2 degree1TextureSize = vec2(textureSize(harmonicsTexture1, 0));\n\n        uint d1 = texelFetch(harmonicsTexture1, getDataUVSplat(3, 0, degree1TextureSize, indexes_sorted), 0).r;\n        uint d2 = texelFetch(harmonicsTexture1, getDataUVSplat(3, 1, degree1TextureSize, indexes_sorted), 0).r;\n        uint d3 = texelFetch(harmonicsTexture1, getDataUVSplat(3, 2, degree1TextureSize, indexes_sorted), 0).r;\n\n        sh1 = unpack111011s(d1);\n        sh2 = unpack111011s(d2);\n        sh3 = unpack111011s(d3);\n\n        float x = worldViewDir.z;\n        float y = worldViewDir.y;\n        float z = worldViewDir.x;\n\n        float xx = 1.;\n        float yy = 1.;\n        float zz = 1.;\n        float xy = 1.;\n        float yz = 1.;\n        float xz = 1.;\n\n        harmonics = SH_C1 * (-sh1 * y + sh2 * z - sh3 * x);\n\n        if(harmonicsDegree > 1.) {\n\n            vec2 degree2TextureSize = vec2(textureSize(harmonicsTexture2, 0));\n\n            uint d4 = texelFetch(harmonicsTexture2, getDataUVSplat(5, 0, degree2TextureSize, indexes_sorted), 0).r;\n            uint d5 = texelFetch(harmonicsTexture2, getDataUVSplat(5, 1, degree2TextureSize, indexes_sorted), 0).r;\n            uint d6 = texelFetch(harmonicsTexture2, getDataUVSplat(5, 2, degree2TextureSize, indexes_sorted), 0).r;\n            uint d7 = texelFetch(harmonicsTexture2, getDataUVSplat(5, 3, degree2TextureSize, indexes_sorted), 0).r;\n            uint d8 = texelFetch(harmonicsTexture2, getDataUVSplat(5, 4, degree2TextureSize, indexes_sorted), 0).r;\n\n\n            sh4 = unpack111011s(d4);\n            sh5 = unpack111011s(d5);\n            sh6 = unpack111011s(d6);\n            sh7 = unpack111011s(d7);\n            sh8 = unpack111011s(d8);\n\n\n            xx = x * x;\n            yy = y * y;\n            zz = z * z;\n            xy = x * y;\n            yz = y * z;\n            xz = x * z;\n\n            harmonics += \n                (SH_C2[0] * xy) * sh4 +\n                (SH_C2[1] * yz) * sh5 +\n                (SH_C2[2] * (2.0 * zz - xx - yy)) * sh6 +\n                (SH_C2[3] * xz) * sh7 +\n                (SH_C2[4] * (xx - yy)) * sh8;\n\n            if(harmonicsDegree > 2.) {\n\n                vec2 degree3TextureSize = vec2(textureSize(harmonicsTexture3, 0));\n\n                uint d9 =  texelFetch(harmonicsTexture3, getDataUVSplat(7, 0, degree3TextureSize, indexes_sorted), 0).r;\n                uint d10 = texelFetch(harmonicsTexture3, getDataUVSplat(7, 1, degree3TextureSize, indexes_sorted), 0).r;\n                uint d11 = texelFetch(harmonicsTexture3, getDataUVSplat(7, 2, degree3TextureSize, indexes_sorted), 0).r;\n                uint d12 = texelFetch(harmonicsTexture3, getDataUVSplat(7, 3, degree3TextureSize, indexes_sorted), 0).r;\n                uint d13 = texelFetch(harmonicsTexture3, getDataUVSplat(7, 4, degree3TextureSize, indexes_sorted), 0).r;\n                uint d14 = texelFetch(harmonicsTexture3, getDataUVSplat(7, 5, degree3TextureSize, indexes_sorted), 0).r;\n                uint d15 = texelFetch(harmonicsTexture3, getDataUVSplat(7, 6, degree3TextureSize, indexes_sorted), 0).r;\n\n                sh9 =  unpack111011s(d9);\n                sh10 = unpack111011s(d10);\n                sh11 = unpack111011s(d11);\n                sh12 = unpack111011s(d12);\n                sh13 = unpack111011s(d13);\n                sh14 = unpack111011s(d14);\n\n                harmonics +=\n                    SH_C3[0] * y * (3.0 * xx - yy) * sh9 +\n                    SH_C3[1] * xy * z * sh10 +\n                    SH_C3[2] * y * (4.0 * zz - xx - yy) * sh11 +\n                    SH_C3[3] * z * (2.0 * zz - 3.0 * xx - 3.0 * yy) * sh12 +\n                    SH_C3[4] * x * (4.0 * zz - xx - yy) * sh13 +\n                    SH_C3[5] * z * (xx - yy) * sh14 +\n                    SH_C3[6] * x * (xx - 3.0 * yy) * sh15;\n\n            }\n        }\n    }\n\n    if(renderOnlyHarmonics) {\n        vColor = harmonicsScale * harmonics;\n    } else {\n        vColor += harmonics;\n    }\n    \n    vColor.rgb = clamp(vColor.rgb, vec3(0.), vec3(1.));\n\n/*\n    //Test the LOD\n    int LOD = int(getLOD( instancePosition, int(vnStart), float(level) ));\n    switch ( LOD ) {\n        case 0:\n            vColor.rgb = vec3(1., 0., 0.);\n        break;\n        case 1:\n            vColor.rgb = vec3(0., 1., 0.);\n        break;\n        case 2:\n            vColor.rgb = vec3(0., 0., 1.);\n        break;\n        case 3:\n            vColor.rgb = vec3(1., 0., 1.);\n        break;\n        case 4:\n            vColor.rgb = vec3(1., 1., 0.);\n        break;\n        case 5:\n            vColor.rgb = vec3(0., 1., 1.);\n        break;\n        case 6:\n            vColor.rgb = vec3(0.5, 0., 0.);\n        break;\n        case 7:\n            vColor.rgb = vec3(0., 0.5, 0.);\n        break;\n        case 8:\n            vColor.rgb = vec3(0.0, 0., 0.5);\n        break;\n        case 9:\n            vColor.rgb = vec3(0.5, 0., 0.5);\n        break;\n        case 10:\n            vColor.rgb = vec3(0.5, 0.5, 0.0);\n        break;\n        case 11:\n            vColor.rgb = vec3(0.0, 0.5, 0.5);\n        break;\n        case 12:\n            vColor.rgb = vec3(1., 1., 1.);\n        break;\n    }\n    */\n\n\tvOpacity = colorData.a;\n}\n';
        },
        504: (t, e, n) => {
          n.d(e, { A: () => o });
          var i = n(931),
            r = n.n(i);
          function o() {
            return r()(
              '(()=>{"use strict";const e={DATA_TYPE_DOUBLE:{ordinal:0,name:"double",size:8},DATA_TYPE_FLOAT:{ordinal:1,name:"float",size:4},DATA_TYPE_INT8:{ordinal:2,name:"int8",size:1},DATA_TYPE_UINT8:{ordinal:3,name:"uint8",size:1},DATA_TYPE_INT16:{ordinal:4,name:"int16",size:2},DATA_TYPE_UINT16:{ordinal:5,name:"uint16",size:2},DATA_TYPE_INT32:{ordinal:6,name:"int32",size:4},DATA_TYPE_UINT32:{ordinal:7,name:"uint32",size:4},DATA_TYPE_INT64:{ordinal:8,name:"int64",size:8},DATA_TYPE_UINT64:{ordinal:9,name:"uint64",size:8}};let t=0;for(const n in e)e[t]=e[n],t++;class n{constructor(e,t,n,r=[1/0,-1/0],a=void 0){this.name=e,this.type=t,this.numElements=n,this.range=r,this.uri=a,this.byteSize=this.numElements*this.type.size,this.description=""}}function r(e,t){var n="undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(!n){if(Array.isArray(e)||(n=function(e,t){if(e){if("string"==typeof e)return a(e,t);var n={}.toString.call(e).slice(8,-1);return"Object"===n&&e.constructor&&(n=e.constructor.name),"Map"===n||"Set"===n?Array.from(e):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?a(e,t):void 0}}(e))||t&&e&&"number"==typeof e.length){n&&(e=n);var r=0,i=function(){};return{s:i,n:function(){return r>=e.length?{done:!0}:{done:!1,value:e[r++]}},e:function(e){throw e},f:i}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var A,T=!0,o=!1;return{s:function(){n=n.call(e)},n:function(){var e=n.next();return T=e.done,e},e:function(e){o=!0,A=e},f:function(){try{T||null==n.return||n.return()}finally{if(o)throw A}}}}function a(e,t){(null==t||t>e.length)&&(t=e.length);for(var n=0,r=Array(t);n<t;n++)r[n]=e[n];return r}new n("POSITION_CARTESIAN",e.DATA_TYPE_FLOAT,3),new n("COLOR_PACKED",e.DATA_TYPE_INT8,4),new n("COLOR_PACKED",e.DATA_TYPE_INT8,4),new n("COLOR_PACKED",e.DATA_TYPE_INT8,3),new n("NORMAL_FLOATS",e.DATA_TYPE_FLOAT,3),new n("INTENSITY",e.DATA_TYPE_UINT16,1),new n("CLASSIFICATION",e.DATA_TYPE_UINT8,1),new n("NORMAL_SPHEREMAPPED",e.DATA_TYPE_UINT8,2),new n("NORMAL_OCT16",e.DATA_TYPE_UINT8,2),new n("NORMAL",e.DATA_TYPE_FLOAT,3),new n("RETURN_NUMBER",e.DATA_TYPE_UINT8,1),new n("NUMBER_OF_RETURNS",e.DATA_TYPE_UINT8,1),new n("SOURCE_ID",e.DATA_TYPE_UINT16,1),new n("INDICES",e.DATA_TYPE_UINT32,1),new n("SPACING",e.DATA_TYPE_FLOAT,1),new n("GPS_TIME",e.DATA_TYPE_DOUBLE,1),Int8Array,Int16Array,Int32Array,Float64Array,Uint8Array,Uint16Array,Uint32Array,Float64Array,Float32Array,Float64Array,onmessage=function(t){var a,i=t.data,A=i.buffer,T=i.pointAttributes,o=(i.scale,i.name,i.min),u=(i.max,i.size),I=i.offset,s=i.numPoints,f=new DataView(A),_={},l=32,E=new Uint32Array(Math.pow(l,3)),N=function(e,t,n){var r=l*e/u.x,a=l*t/u.y,i=l*n/u.z,A=Math.min(parseInt(r),31),T=Math.min(parseInt(a),31),o=Math.min(parseInt(i),31);return A+T*l+o*l*l},m=0,y=[Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY],c=[Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY],P=r(T.attributes);try{for(P.s();!(a=P.n()).done;){var D=a.value;if(["POSITION_CARTESIAN","position"].includes(D.name)){for(var b=new ArrayBuffer(4*s*3),h=new Float32Array(b),Y=0;Y<s;Y++){var w=12*Y,d=f.getFloat32(w+0,!0)+I[0]-o.x,O=f.getFloat32(w+4,!0)+I[1]-o.y,v=f.getFloat32(w+8,!0)+I[2]-o.z;y[0]=Math.min(y[0],d),y[1]=Math.min(y[1],O),y[2]=Math.min(y[2],v),c[0]=Math.max(c[0],d),c[1]=Math.max(c[1],O),c[2]=Math.max(c[2],v),0===E[N(d,O,v)]++&&m++,h[3*Y+0]=d,h[3*Y+1]=O,h[3*Y+2]=v}_[D.name]={buffer:b,attribute:D}}else["RGBA","rgba"].includes(D.name)&&(_[D.name]={buffer:A.slice(12*s),attribute:D})}}catch(e){P.e(e)}finally{P.f()}for(var F=parseInt(s/m),S=new ArrayBuffer(4*s),U=new Uint32Array(S),p=0;p<s;p++)U[p]=p;_.INDICES={buffer:S,attribute:n.INDICES};var M,g=r(T.vectors);try{for(g.s();!(M=g.n()).done;){var R,C=M.value,L=C.name,z=C.attributes,B=z.length,x=new ArrayBuffer(B*s*4),V=new Float32Array(x),G=0,K=r(z);try{for(K.s();!(R=K.n()).done;){for(var j=_[R.value],H=j.offset,$=j.scale,k=new DataView(j.buffer),q=k.getFloat32.bind(k),J=0;J<s;J++){var Q=q(4*J,!0);V[J*B+G]=Q/$+H}G++}}catch(e){K.e(e)}finally{K.f()}var W=new n(L,e.DATA_TYPE_FLOAT,3);_[L]={buffer:x,attribute:W}}}catch(e){g.e(e)}finally{g.f()}var X={buffer:A,attributeBuffers:_,density:F,tightBoundingBox:{min:y,max:c}},Z=[];for(var ee in X.attributeBuffers)Z.push(X.attributeBuffers[ee].buffer);Z.push(A),postMessage(X,Z)}})();\n',
              'Worker',
              void 0,
              void 0,
            );
          }
        },
        604: (e) => {
          e.exports = t;
        },
        931: (t) => {
          t.exports = function (t, e, n, i) {
            var r = self || window;
            try {
              try {
                var o;
                try {
                  o = new r.Blob([t]);
                } catch (e) {
                  ((o = new (r.BlobBuilder ||
                    r.WebKitBlobBuilder ||
                    r.MozBlobBuilder ||
                    r.MSBlobBuilder)()).append(t),
                    (o = o.getBlob()));
                }
                var s = r.URL || r.webkitURL,
                  a = s.createObjectURL(o),
                  l = new r[e](a, n);
                return (s.revokeObjectURL(a), l);
              } catch (i) {
                return new r[e]('data:application/javascript,'.concat(encodeURIComponent(t)), n);
              }
            } catch (t) {
              if (!i) throw Error('Inline worker is not supported');
              return new r[e](i, n);
            }
          };
        },
        942: (t, e, n) => {
          n.d(e, { A: () => i });
          const i =
            'precision highp float;\nprecision highp int;\n\nuniform float opacity;\nuniform bool renderIds;\nuniform bool debugMode;\n\nin vec3 vColor;\nin float vOpacity;\nin vec2 vPosition;\nin float backfaseCulling;\nin vec2 vID;\n\nout vec4 color_data;\n\nuvec3 murmurHash31(uint src) {\n    const uint M = 0x5bd1e995u;\n    uvec3 h = uvec3(1190494759u, 2147483647u, 3559788179u);\n    src *= M; src ^= src>>24u; src *= M;\n    h *= M; h ^= src;\n    h ^= h>>13u; h *= M; h ^= h>>15u;\n    return h;\n}\n\n// 3 outputs, 1 input\nvec3 hash31(float src) {\n    uvec3 h = murmurHash31(floatBitsToUint(src));\n    return uintBitsToFloat(h & 0x007fffffu | 0x3f800000u) - 1.0;\n}\n\nvoid main() {\n\n\tfloat A = dot(vPosition, vPosition);\n\tif (A > 8.0) discard;\n\t\n\tfloat opacity = exp(-0.5 * A) * vOpacity;\n\tcolor_data = vec4(vColor, opacity);\n\t\n\tif(debugMode){\n\t\tif(opacity < 0.1) discard;\n\t\tcolor_data = vec4( hash31(vID.x), 1.);\t\n\t}\n\n\tif(renderIds) {\n\t\tif(opacity < 0.1) discard;\n\t\tcolor_data = vec4(vID, 0., 1.);\n\t} \n\n}\n';
        },
        950: (t, e, n) => {
          n.d(e, { A: () => o });
          var i = n(931),
            r = n.n(i);
          function o() {
            return r()(
              '(()=>{"use strict";const r={DATA_TYPE_DOUBLE:{ordinal:0,name:"double",size:8},DATA_TYPE_FLOAT:{ordinal:1,name:"float",size:4},DATA_TYPE_INT8:{ordinal:2,name:"int8",size:1},DATA_TYPE_UINT8:{ordinal:3,name:"uint8",size:1},DATA_TYPE_INT16:{ordinal:4,name:"int16",size:2},DATA_TYPE_UINT16:{ordinal:5,name:"uint16",size:2},DATA_TYPE_INT32:{ordinal:6,name:"int32",size:4},DATA_TYPE_UINT32:{ordinal:7,name:"uint32",size:4},DATA_TYPE_INT64:{ordinal:8,name:"int64",size:8},DATA_TYPE_UINT64:{ordinal:9,name:"uint64",size:8}};let t=0;for(const a in r)r[t]=r[a],t++;class a{constructor(r,t,a,e=[1/0,-1/0],n=void 0){this.name=r,this.type=t,this.numElements=a,this.range=e,this.uri=n,this.byteSize=this.numElements*this.type.size,this.description=""}}function e(r){throw new TypeError(\'"\'+r+\'" is read-only\')}function n(r,t){var a="undefined"!=typeof Symbol&&r[Symbol.iterator]||r["@@iterator"];if(!a){if(Array.isArray(r)||(a=function(r,t){if(r){if("string"==typeof r)return i(r,t);var a={}.toString.call(r).slice(8,-1);return"Object"===a&&r.constructor&&(a=r.constructor.name),"Map"===a||"Set"===a?Array.from(r):"Arguments"===a||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(a)?i(r,t):void 0}}(r))||t&&r&&"number"==typeof r.length){a&&(r=a);var e=0,n=function(){};return{s:n,n:function(){return e>=r.length?{done:!0}:{done:!1,value:r[e++]}},e:function(r){throw r},f:n}}throw new TypeError("Invalid attempt to iterate non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}var o,f=!0,A=!1;return{s:function(){a=a.call(r)},n:function(){var r=a.next();return f=r.done,r},e:function(r){A=!0,o=r},f:function(){try{f||null==a.return||a.return()}finally{if(A)throw o}}}}function i(r,t){(null==t||t>r.length)&&(t=r.length);for(var a=0,e=Array(t);a<t;a++)e[a]=r[a];return e}new a("POSITION_CARTESIAN",r.DATA_TYPE_FLOAT,3),new a("COLOR_PACKED",r.DATA_TYPE_INT8,4),new a("COLOR_PACKED",r.DATA_TYPE_INT8,4),new a("COLOR_PACKED",r.DATA_TYPE_INT8,3),new a("NORMAL_FLOATS",r.DATA_TYPE_FLOAT,3),new a("INTENSITY",r.DATA_TYPE_UINT16,1),new a("CLASSIFICATION",r.DATA_TYPE_UINT8,1),new a("NORMAL_SPHEREMAPPED",r.DATA_TYPE_UINT8,2),new a("NORMAL_OCT16",r.DATA_TYPE_UINT8,2),new a("NORMAL",r.DATA_TYPE_FLOAT,3),new a("RETURN_NUMBER",r.DATA_TYPE_UINT8,1),new a("NUMBER_OF_RETURNS",r.DATA_TYPE_UINT8,1),new a("SOURCE_ID",r.DATA_TYPE_UINT16,1),new a("INDICES",r.DATA_TYPE_UINT32,1),new a("SPACING",r.DATA_TYPE_FLOAT,1),new a("GPS_TIME",r.DATA_TYPE_DOUBLE,1),Int8Array,Int16Array,Int32Array,Float64Array,Uint8Array,Uint16Array,Uint32Array,Float64Array,Float32Array,Float64Array,onmessage=function(t){var i,o,f,A=t.data,_=A.buffer,u=A.pointAttributes,l=(A.scale,A.name,A.min),s=(A.max,A.size),T=A.offset,y=A.numPoints,I=A.harmonicsEnabled,h=new DataView(_),w={},b=32,m=new Uint32Array(Math.pow(b,3)),N=function(r,t,a){var e=b*r/s.x,n=b*t/s.y,i=b*a/s.z,o=Math.min(parseInt(e),31),f=Math.min(parseInt(n),31),A=Math.min(parseInt(i),31);return o+f*b+A*b*b},E=function(r,t,a){return Math.max(Math.min(r,a),t)},d=0,M=[Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY,Number.POSITIVE_INFINITY],c=[Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY,Number.NEGATIVE_INFINITY],v=new ArrayBuffer(4*y*3),p=new Float32Array(v),O=new ArrayBuffer(4*y*4),F=new Float32Array(O),x=new ArrayBuffer(4*y*4),P=new Float32Array(x),D=new ArrayBuffer(4*y*4),z=new Float32Array(D),Y=new ArrayBuffer(4*y*4),C=new Float32Array(Y),S=new ArrayBuffer(4*y*45),g=new Float32Array(S),R=0,U=["sh_band_1_triplet_0","sh_band_1_triplet_1","sh_band_1_triplet_2","sh_band_2_triplet_0","sh_band_2_triplet_1","sh_band_2_triplet_2","sh_band_2_triplet_3","sh_band_2_triplet_4","sh_band_3_triplet_0","sh_band_3_triplet_1","sh_band_3_triplet_2","sh_band_3_triplet_3","sh_band_3_triplet_4","sh_band_3_triplet_5","sh_band_3_triplet_6"],B=n(u.attributes);try{for(B.s();!(i=B.n()).done;){var L=i.value;if(["POSITION_CARTESIAN","position"].includes(L.name)){for(var V=0;V<y;V++){var H=12*V,G=h.getFloat32(H+0,!0),K=h.getFloat32(H+4,!0),j=h.getFloat32(H+8,!0),q=G+T[0]-l.x,$=K+T[1]-l.y,k=j+T[2]-l.z;M[0]=Math.min(M[0],q),M[1]=Math.min(M[1],$),M[2]=Math.min(M[2],k),c[0]=Math.max(c[0],q),c[1]=Math.max(c[1],$),c[2]=Math.max(c[2],k),0===m[N(q,$,k)]++&&d++,P[4*V+0]=q,P[4*V+1]=$,P[4*V+2]=k,C[4*V+0]=G,C[4*V+1]=K,C[4*V+2]=j}w.raw_position={buffer:Y,attribute:"raw_position"},w.position={buffer:x,attribute:"position"}}else if(["sh_band_0"].includes(L.name))for(var J=.28209479177387814,Q=0;Q<y;Q++){var W=4*Q+0,X=4*Q+1,Z=4*Q+2,rr=4*Q+3,tr=12*Q+12*y,ar=4*Q+24*y,er=h.getFloat32(tr+0,!0),nr=h.getFloat32(tr+4,!0),ir=h.getFloat32(tr+8,!0);z[W]=255*(.5+J*er),z[X]=255*(.5+J*nr),z[Z]=255*(.5+J*ir),z[W]=E(Math.floor(z[W]),0,255),z[X]=E(Math.floor(z[X]),0,255),z[Z]=E(Math.floor(z[Z]),0,255);var or=h.getFloat32(ar,!0);or=1/(1+Math.exp(-or))*255,z[rr]=E(Math.floor(or),0,255)}else if(["scale"].includes(L.name)){for(var fr=0,Ar=0;Ar<y;Ar++){var _r=12*Ar+28*y,ur=h.getFloat32(_r+0,!0),lr=h.getFloat32(_r+4,!0),sr=h.getFloat32(_r+8,!0);p[3*Ar+0]=Math.exp(ur),p[3*Ar+1]=Math.exp(lr),p[3*Ar+2]=Math.exp(sr);var Tr=Math.max(Math.exp(ur),Math.exp(lr));Tr>fr&&(fr=Tr)}w.scale={buffer:v,attribute:"scale"}}else if(["rotation"].includes(L.name)){for(var yr={x:0,y:0,z:0,w:0},Ir=0;Ir<y;Ir++){var hr=16*Ir+40*y,wr=h.getFloat32(hr+0,!0),br=h.getFloat32(hr+4,!0),mr=h.getFloat32(hr+8,!0),Nr=h.getFloat32(hr+12,!0);yr.x=wr,yr.y=br,yr.z=mr,yr.w=Nr;var Er=Math.sqrt(wr*wr+br*br+mr*mr+Nr*Nr);0==Er?(yr.x=0,yr.y=0,yr.z=0,yr.w=1):(yr.x=wr/Er,yr.y=br/Er,yr.z=mr/Er,yr.w=Nr/Er),F[4*Ir+0]=yr.x,F[4*Ir+1]=yr.y,F[4*Ir+2]=yr.z,F[4*Ir+3]=yr.w}w.orientation={buffer:O,attribute:"orientation"}}else if(L.name.indexOf("triplet")>-1&&I)for(var dr=0;dr<y;dr++){var Mr=U.indexOf(L.name),cr=12*dr+y*(56+12*Mr),vr=h.getFloat32(cr+0,!0),pr=h.getFloat32(cr+4,!0),Or=h.getFloat32(cr+8,!0);g[45*dr+3*Mr+0]=vr,g[45*dr+3*Mr+1]=pr,g[45*dr+3*Mr+2]=Or,R=Math.max(Math.abs(vr),R),R=Math.max(Math.abs(pr),R),R=Math.max(Math.abs(Or),R)}}}catch(r){B.e(r)}finally{B.f()}for(var Fr=function(r,t,a){var e=function(r,t){var a=new Array(16),e=r.x,n=r.y,i=r.z,o=r.w,f=e+e,A=n+n,_=i+i,u=e*f,l=e*A,s=e*_,T=n*A,y=n*_,I=i*_,h=o*f,w=o*A,b=o*_,m=t.x,N=t.y,E=t.z;a[0]=(1-(T+I))*m,a[1]=(l+b)*m,a[2]=(s-w)*m,a[3]=(l-b)*N,a[4]=(1-(u+I))*N,a[5]=(y+h)*N,a[6]=(s+w)*E,a[7]=(y-h)*E,a[8]=(1-(u+T))*E;var d,M,c,v,p,O,F,x,P,D,z,Y,C,S,g,R,U,B,L,V,H,G,K=a.map(function(r){return r}),j=K;return d=j[1],j[1]=j[3],j[3]=d,d=j[2],j[2]=j[6],j[6]=d,d=j[5],j[5]=j[7],j[7]=d,M=a,c=K,v=new Array(9),p=M[0],O=M[3],F=M[6],x=M[1],P=M[4],D=M[7],z=M[2],Y=M[5],C=M[8],S=c[0],g=c[3],R=c[6],U=c[1],B=c[4],L=c[7],V=c[2],H=c[5],G=c[8],v[0]=p*S+O*U+F*V,v[3]=p*g+O*B+F*H,v[6]=p*R+O*L+F*G,v[1]=x*S+P*U+D*V,v[4]=x*g+P*B+D*H,v[7]=x*R+P*L+D*G,v[2]=z*S+Y*U+C*V,v[5]=z*g+Y*B+C*H,v[8]=z*R+Y*L+C*G,v}(t,r);Pr[4*a+0]=e[0],Pr[4*a+1]=e[3],Pr[4*a+2]=e[6],Pr[4*a+3]=e[4],zr[2*a+0]=e[7],zr[2*a+1]=e[8]},xr=new ArrayBuffer(4*y*4),Pr=new Float32Array(xr),Dr=new ArrayBuffer(4*y*2),zr=new Float32Array(Dr),Yr=0;Yr<y;Yr++){var Cr={x:0,y:0,z:0,w:0},Sr={x:0,y:0,z:0};Cr.w=F[4*Yr+0],Cr.x=F[4*Yr+1],Cr.y=F[4*Yr+2],Cr.z=F[4*Yr+3],Sr.x=p[3*Yr+0],Sr.y=p[3*Yr+1],Sr.z=p[3*Yr+2],Fr(Sr,Cr,Yr)}w.COVARIANCE0={buffer:xr,attribute:a.COVARIANCE0},w.COVARIANCE1={buffer:Dr,attribute:a.COVARIANCE1};for(var gr=function(r){return r[0]+(r[1]<<8)+(r[2]<<16)+(r[3]<<24)},Rr=Math.floor(255*Math.random()),Ur=Math.floor(255*Math.random()),Br=Math.floor(255*Math.random()),Lr=(o=new Float32Array(1),f=new Int32Array(o.buffer),function(r){return o[0]=r,f[0]}),Vr=new ArrayBuffer(4*y*4),Hr=new Int32Array(Vr),Gr=0;Gr<y;Gr++){var Kr={x:0,y:0,z:0,w:0},jr={x:0,y:0,z:0};Kr.x=z[4*Gr+0],Kr.y=z[4*Gr+1],Kr.z=z[4*Gr+2],Kr.w=z[4*Gr+3],jr.x=P[4*Gr+0],jr.y=P[4*Gr+1],jr.z=P[4*Gr+2];var qr=gr([0*Rr+1*Kr.x,0*Ur+1*Kr.y,0*Br+1*Kr.z,Kr.w]);jr.x=Lr(jr.x),jr.y=Lr(jr.y),jr.z=Lr(jr.z),Hr[4*Gr+0]=qr,Hr[4*Gr+1]=jr.x,Hr[4*Gr+2]=jr.y,Hr[4*Gr+3]=jr.z}w.POS_COLOR={buffer:Vr,attribute:a.POS_COLOR};var $r=new ArrayBuffer(4*y*3),kr=new Uint32Array($r),Jr=new ArrayBuffer(4*y*5),Qr=new Uint32Array(Jr),Wr=new ArrayBuffer(4*y*7),Xr=new Uint32Array(Wr);g=g.map(function(r,t){r/=R,r=.5*(r=Math.min(Math.max(r,-1),1))+.5;var a=t%3==1?1023:2047;return Math.min(Math.max(Math.floor(r*a),0),a)});for(var Zr=0;Zr<y;Zr++)for(var rt=0;rt<15;rt++){var tt=g[45*Zr+3*rt+0],at=g[45*Zr+3*rt+1],et=g[45*Zr+3*rt+2];rt<3&&(kr[3*Zr+rt-0]=tt<<21|at<<11|et),rt>=3&&rt<8&&(Qr[5*Zr+rt-3]=tt<<21|at<<11|et),rt>=8&&(Xr[7*Zr+rt-8]=tt<<21|at<<11|et)}w.HARMONICS1={buffer:$r,attribute:"HARMONICS1"},w.HARMONICS2={buffer:Jr,attribute:"HARMONICS2"},w.HARMONICS3={buffer:Wr,attribute:"HARMONICS3"};for(var nt=parseInt(y/d),it=new ArrayBuffer(4*y),ot=new Uint32Array(it),ft=0;ft<y;ft++)ot[ft]=ft;w.INDICES={buffer:it,attribute:a.INDICES};var At,_t=n(u.vectors);try{for(_t.s();!(At=_t.n()).done;){var ut,lt=At.value,st=lt.name,Tt=lt.attributes,yt=Tt.length,It=new ArrayBuffer(yt*y*4),ht=new Float32Array(It),wt=n(Tt);try{for(wt.s();!(ut=wt.n()).done;){for(var bt=w[ut.value],mt=bt.offset,Nt=bt.scale,Et=new DataView(bt.buffer),dt=Et.getFloat32.bind(Et),Mt=0;Mt<y;Mt++){var ct=dt(4*Mt,!0);ht[Mt*yt+0]=ct/Nt+mt}e("iElement")}}catch(r){wt.e(r)}finally{wt.f()}var vt=new a(st,r.DATA_TYPE_FLOAT,3);w[st]={buffer:It,attribute:vt}}}catch(r){_t.e(r)}finally{_t.f()}var pt={buffer:_,attributeBuffers:w,density:nt,tightBoundingBox:{min:M,max:c}},Ot=[];for(var Ft in pt.attributeBuffers)Ot.push(pt.attributeBuffers[Ft].buffer);Ot.push(_),postMessage(pt,Ot)}})();\n',
              'Worker',
              void 0,
              void 0,
            );
          }
        },
        952: (t, e, n) => {
          n.d(e, { A: () => i });
          const i =
            'precision highp float;\nprecision highp int;\n\nuniform mat4 viewMatrix;\nuniform vec3 cameraPosition;\n\nuniform mat4 projectionMatrix;\nuniform float opacity;\n\nuniform float blendHardness;\nuniform float blendDepthSupplement;\nuniform float fov;\nuniform float spacing;\nuniform float pcIndex;\nuniform float screenWidth;\nuniform float screenHeight;\n\nuniform sampler2D depthMap;\n\n#if defined (clip_horizontally) || defined (clip_vertically)\n\tuniform vec4 clipExtent;\n#endif\n\n#ifdef use_texture_blending\n\tuniform sampler2D backgroundMap;\n#endif\n\n\n#ifdef use_point_cloud_mixing\n\tuniform int pointCloudMixingMode;\n\tuniform float pointCloudID;\n\tuniform float pointCloudMixAngle;\n\tuniform float stripeDistanceX;\n\tuniform float stripeDistanceY;\n\n\tuniform float stripeDivisorX;\n\tuniform float stripeDivisorY;\n#endif\n\n#ifdef highlight_point\n\tuniform vec4 highlightedPointColor;\n#endif\n\nin vec3 vColor;\n\n#if !defined(color_type_point_index)\n\tin float vOpacity;\n#endif\n\n#if defined(weighted_splats)\n\tin float vLinearDepth;\n#endif\n\n#if !defined(paraboloid_point_shape) && defined(use_edl)\n\tin float vLogDepth;\n#endif\n\n#if defined(color_type_phong) && (MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0) || defined(paraboloid_point_shape)\n\tin vec3 vViewPosition;\n#endif\n\n#if defined(weighted_splats) || defined(paraboloid_point_shape)\n\tin float vRadius;\n#endif\n\n#if defined(color_type_phong) && (MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0)\n\tin vec3 vNormal;\n#endif\n\n#ifdef highlight_point\n\tin float vHighlight;\n#endif\n\nout vec4 outFragColor;\n\nfloat specularStrength = 1.0;\n\nvoid main() {\n\tvec3 color = vColor;\n\tfloat depth = gl_FragCoord.z;\n\n\t#if defined (clip_horizontally) || defined (clip_vertically)\n\tvec2 ndc = vec2((gl_FragCoord.x / screenWidth), 1.0 - (gl_FragCoord.y / screenHeight));\n\n\tif(step(clipExtent.x, ndc.x) * step(ndc.x, clipExtent.z) < 1.0)\n\t{\n\t\tdiscard;\n\t}\n\n\tif(step(clipExtent.y, ndc.y) * step(ndc.y, clipExtent.w) < 1.0)\n\t{\n\t\tdiscard;\n\t}\n\t#endif  \n\n\t#if defined(circle_point_shape) || defined(paraboloid_point_shape) || defined (weighted_splats)\n\t\tfloat u = 2.0 * gl_PointCoord.x - 1.0;\n\t\tfloat v = 2.0 * gl_PointCoord.y - 1.0;\n\t#endif\n\n\t#if defined(circle_point_shape) || defined (weighted_splats)\n\t\tfloat cc = u*u + v*v;\n\t\tif(cc > 1.0){\n\t\t\tdiscard;\n\t\t}\n\t#endif\n\n\t#if defined weighted_splats\n\t\tvec2 uv = gl_FragCoord.xy / vec2(screenWidth, screenHeight);\n\t\tfloat sDepth = texture(depthMap, uv).r;\n\t\tif(vLinearDepth > sDepth + vRadius + blendDepthSupplement){\n\t\t\tdiscard;\n\t\t}\n\t#endif\n\n\t#if defined color_type_point_index\n\t\toutFragColor = vec4(color, pcIndex / 255.0);\n\t#else\n\t\toutFragColor = vec4(color, vOpacity);\n\t#endif\n\n\t#ifdef use_point_cloud_mixing\n\t\tbool discardFragment = false;\n\n\t\tif (pointCloudMixingMode == 1) {  // Checkboard\n\t\t\tfloat vPointCloudID = pointCloudID > 10. ? pointCloudID/10.: pointCloudID;\n\t\t\tdiscardFragment = mod(gl_FragCoord.x, vPointCloudID) > 0.5 && mod(gl_FragCoord.y, vPointCloudID) > 0.5;\n\t\t}\n\t\telse if (pointCloudMixingMode == 2) {  // Stripes\n\t\t\tfloat angle = pointCloudMixAngle * pointCloudID / 180.;\n\t\t\tfloat u = cos(angle) * gl_FragCoord.x + sin(angle) * gl_FragCoord.y;\n\t\t\tfloat v = -sin(angle) * gl_FragCoord.x + cos(angle) * gl_FragCoord.y;\n\n\t\t\tdiscardFragment = mod(u, stripeDistanceX) >= stripeDistanceX/stripeDivisorX && mod(v, stripeDistanceY) >= stripeDistanceY/stripeDivisorY;\n\t\t}\n\t\tif (discardFragment) {\n\t\t\tdiscard;\n\t\t}\n\t#endif\n\n\t#ifdef use_texture_blending\n\t\tvec2 vUv = gl_FragCoord.xy / vec2(screenWidth, screenHeight);\n\n\t\tvec4 tColor = texture(backgroundMap, vUv);\n\t\toutFragColor = vec4(vOpacity * color, 1.) + vec4((1. - vOpacity) * tColor.rgb, 0.);\n\t#endif\n\n\t#if defined(color_type_phong)\n\t\t#if MAX_POINT_LIGHTS > 0 || MAX_DIR_LIGHTS > 0\n\t\t\tvec3 normal = normalize( vNormal );\n\t\t\tnormal.z = abs(normal.z);\n\n\t\t\tvec3 viewPosition = normalize( vViewPosition );\n\t\t#endif\n\n\t\t// code taken from three.js phong light fragment shader\n\n\t\t#if MAX_POINT_LIGHTS > 0\n\n\t\t\tvec3 pointDiffuse = vec3( 0.0 );\n\t\t\tvec3 pointSpecular = vec3( 0.0 );\n\n\t\t\tfor ( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {\n\n\t\t\t\tvec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );\n\t\t\t\tvec3 lVector = lPosition.xyz + vViewPosition.xyz;\n\n\t\t\t\tfloat lDistance = 1.0;\n\t\t\t\tif ( pointLightDistance[ i ] > 0.0 )\n\t\t\t\t\tlDistance = 1.0 - min( ( length( lVector ) / pointLightDistance[ i ] ), 1.0 );\n\n\t\t\t\tlVector = normalize( lVector );\n\n\t\t\t\t\t\t// diffuse\n\n\t\t\t\tfloat dotProduct = dot( normal, lVector );\n\n\t\t\t\t#ifdef WRAP_AROUND\n\n\t\t\t\t\tfloat pointDiffuseWeightFull = max( dotProduct, 0.0 );\n\t\t\t\t\tfloat pointDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );\n\n\t\t\t\t\tvec3 pointDiffuseWeight = mix( vec3( pointDiffuseWeightFull ), vec3( pointDiffuseWeightHalf ), wrapRGB );\n\n\t\t\t\t#else\n\n\t\t\t\t\tfloat pointDiffuseWeight = max( dotProduct, 0.0 );\n\n\t\t\t\t#endif\n\n\t\t\t\tpointDiffuse += diffuse * pointLightColor[ i ] * pointDiffuseWeight * lDistance;\n\n\t\t\t\t// specular\n\n\t\t\t\tvec3 pointHalfVector = normalize( lVector + viewPosition );\n\t\t\t\tfloat pointDotNormalHalf = max( dot( normal, pointHalfVector ), 0.0 );\n\t\t\t\tfloat pointSpecularWeight = specularStrength * max( pow( pointDotNormalHalf, shininess ), 0.0 );\n\n\t\t\t\tfloat specularNormalization = ( shininess + 2.0 ) / 8.0;\n\n\t\t\t\tvec3 schlick = specular + vec3( 1.0 - specular ) * pow( max( 1.0 - dot( lVector, pointHalfVector ), 0.0 ), 5.0 );\n\t\t\t\tpointSpecular += schlick * pointLightColor[ i ] * pointSpecularWeight * pointDiffuseWeight * lDistance * specularNormalization;\n\t\t\t\tpointSpecular = vec3(0.0, 0.0, 0.0);\n\t\t\t}\n\n\t\t#endif\n\n\t\t#if MAX_DIR_LIGHTS > 0\n\n\t\t\tvec3 dirDiffuse = vec3( 0.0 );\n\t\t\tvec3 dirSpecular = vec3( 0.0 );\n\n\t\t\tfor( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {\n\n\t\t\t\tvec4 lDirection = viewMatrix * vec4( directionalLightDirection[ i ], 0.0 );\n\t\t\t\tvec3 dirVector = normalize( lDirection.xyz );\n\n\t\t\t\t\t\t// diffuse\n\n\t\t\t\tfloat dotProduct = dot( normal, dirVector );\n\n\t\t\t\t#ifdef WRAP_AROUND\n\n\t\t\t\t\tfloat dirDiffuseWeightFull = max( dotProduct, 0.0 );\n\t\t\t\t\tfloat dirDiffuseWeightHalf = max( 0.5 * dotProduct + 0.5, 0.0 );\n\n\t\t\t\t\tvec3 dirDiffuseWeight = mix( vec3( dirDiffuseWeightFull ), vec3( dirDiffuseWeightHalf ), wrapRGB );\n\n\t\t\t\t#else\n\n\t\t\t\t\tfloat dirDiffuseWeight = max( dotProduct, 0.0 );\n\n\t\t\t\t#endif\n\n\t\t\t\tdirDiffuse += diffuse * directionalLightColor[ i ] * dirDiffuseWeight;\n\n\t\t\t\t// specular\n\n\t\t\t\tvec3 dirHalfVector = normalize( dirVector + viewPosition );\n\t\t\t\tfloat dirDotNormalHalf = max( dot( normal, dirHalfVector ), 0.0 );\n\t\t\t\tfloat dirSpecularWeight = specularStrength * max( pow( dirDotNormalHalf, shininess ), 0.0 );\n\n\t\t\t\tfloat specularNormalization = ( shininess + 2.0 ) / 8.0;\n\n\t\t\t\tvec3 schlick = specular + vec3( 1.0 - specular ) * pow( max( 1.0 - dot( dirVector, dirHalfVector ), 0.0 ), 5.0 );\n\t\t\t\tdirSpecular += schlick * directionalLightColor[ i ] * dirSpecularWeight * dirDiffuseWeight * specularNormalization;\n\t\t\t}\n\n\t\t#endif\n\n\t\tvec3 totalDiffuse = vec3( 0.0 );\n\t\tvec3 totalSpecular = vec3( 0.0 );\n\n\t\t#if MAX_POINT_LIGHTS > 0\n\n\t\t\ttotalDiffuse += pointDiffuse;\n\t\t\ttotalSpecular += pointSpecular;\n\n\t\t#endif\n\n\t\t#if MAX_DIR_LIGHTS > 0\n\n\t\t\ttotalDiffuse += dirDiffuse;\n\t\t\ttotalSpecular += dirSpecular;\n\n\t\t#endif\n\n\t\toutFragColor.xyz = outFragColor.xyz * ( emissive + totalDiffuse + ambientLightColor * ambient ) + totalSpecular;\n\n\t#endif\n\n\t#if defined weighted_splats\n\t    //float w = pow(1.0 - (u*u + v*v), blendHardness);\n\n\t\tfloat wx = 2.0 * length(2.0 * gl_PointCoord - 1.0);\n\t\tfloat w = exp(-wx * wx * 0.5);\n\n\t\t//float distance = length(2.0 * gl_PointCoord - 1.0);\n\t\t//float w = exp( -(distance * distance) / blendHardness);\n\n\t\toutFragColor.rgb = outFragColor.rgb * w;\n\t\toutFragColor.a = w;\n\t#endif\n\n\t#if defined paraboloid_point_shape\n\t\tfloat wi = 0.0 - ( u*u + v*v);\n\t\tvec4 pos = vec4(vViewPosition, 1.0);\n\t\tpos.z += wi * vRadius;\n\t\tfloat linearDepth = -pos.z;\n\t\tpos = projectionMatrix * pos;\n\t\tpos = pos / pos.w;\n\t\tfloat expDepth = pos.z;\n\t\tdepth = (pos.z + 1.0) / 2.0;\n\t\tgl_FragDepth = depth;\n\n\t\t#if defined(color_type_depth)\n\t\t\toutFragColor.r = linearDepth;\n\t\t\toutFragColor.g = expDepth;\n\t\t#endif\n\n\t\t#if defined(use_edl)\n\t\t\toutFragColor.a = log2(linearDepth);\n\t\t#endif\n\n\t#else\n\t\t#if defined(use_edl)\n\t\t\toutFragColor.a = vLogDepth;\n\t\t#endif\n\t#endif\n\n\t#ifdef highlight_point\n\t\tif (vHighlight > 0.0) {\n\t\t\toutFragColor = highlightedPointColor;\n\t\t}\n\t#endif\n}\n';
        },
      },
      n = {};
    function i(t) {
      var r = n[t];
      if (void 0 !== r) return r.exports;
      var o = (n[t] = { exports: {} });
      return (e[t](o, o.exports, i), o.exports);
    }
    ((i.n = (t) => {
      var e = t && t.__esModule ? () => t.default : () => t;
      return (i.d(e, { a: e }), e);
    }),
      (i.d = (t, e) => {
        for (var n in e)
          i.o(e, n) && !i.o(t, n) && Object.defineProperty(t, n, { enumerable: !0, get: e[n] });
      }),
      (i.o = (t, e) => Object.prototype.hasOwnProperty.call(t, e)),
      (i.r = (t) => {
        ('undefined' != typeof Symbol &&
          Symbol.toStringTag &&
          Object.defineProperty(t, Symbol.toStringTag, { value: 'Module' }),
          Object.defineProperty(t, '__esModule', { value: !0 }));
      }));
    var r = {};
    (i.r(r),
      i.d(r, {
        BlurMaterial: () => p,
        ClipMode: () => o,
        GRAYSCALE: () => T,
        INFERNO: () => w,
        NormalFilteringMode: () => c,
        PLASMA: () => I,
        POINT_ATTRIBUTES: () => q,
        POINT_ATTRIBUTE_TYPES: () => j,
        PointAttributeName: () => W,
        PointAttributes: () => Q,
        PointCloudMaterial: () => V,
        PointCloudMixingMode: () => h,
        PointCloudOctree: () => dt,
        PointCloudOctreeGeometry: () => nt,
        PointCloudOctreeGeometryNode: () => et,
        PointCloudOctreeNode: () => it,
        PointCloudOctreePicker: () => ot,
        PointCloudTree: () => at,
        PointColorType: () => d,
        PointOpacityType: () => u,
        PointShape: () => a,
        PointSizeType: () => s,
        Potree: () => qt,
        QueueItem: () => Kt,
        RAINBOW: () => N,
        SPECTRAL: () => S,
        SplatsMesh: () => ut,
        TreeType: () => l,
        V1_LOADER: () => _t,
        V2_LOADER: () => Vt,
        VIRIDIS: () => C,
        Version: () => vt,
        YELLOW_GREEN: () => E,
        generateClassificationTexture: () => D,
        generateDataTexture: () => P,
        generateGradientTexture: () => O,
      }));
    var o,
      s,
      a,
      l,
      u,
      d,
      c,
      h,
      f = i(604);
    class p extends f.ShaderMaterial {
      constructor() {
        (super(...arguments),
          (this.vertexShader = i(183)),
          (this.fragmentShader = i(46)),
          (this.uniforms = {
            screenWidth: { type: 'f', value: 0 },
            screenHeight: { type: 'f', value: 0 },
            map: { type: 't', value: null },
          }));
      }
    }
    (!(function (t) {
      ((t[(t.DISABLED = 0)] = 'DISABLED'),
        (t[(t.CLIP_OUTSIDE = 1)] = 'CLIP_OUTSIDE'),
        (t[(t.HIGHLIGHT_INSIDE = 2)] = 'HIGHLIGHT_INSIDE'),
        (t[(t.CLIP_HORIZONTALLY = 3)] = 'CLIP_HORIZONTALLY'),
        (t[(t.CLIP_VERTICALLY = 4)] = 'CLIP_VERTICALLY'),
        (t[(t.CLIP_INSIDE = 5)] = 'CLIP_INSIDE'));
    })(o || (o = {})),
      (function (t) {
        ((t[(t.FIXED = 0)] = 'FIXED'),
          (t[(t.ATTENUATED = 1)] = 'ATTENUATED'),
          (t[(t.ADAPTIVE = 2)] = 'ADAPTIVE'));
      })(s || (s = {})),
      (function (t) {
        ((t[(t.SQUARE = 0)] = 'SQUARE'),
          (t[(t.CIRCLE = 1)] = 'CIRCLE'),
          (t[(t.PARABOLOID = 2)] = 'PARABOLOID'));
      })(a || (a = {})),
      (function (t) {
        ((t[(t.OCTREE = 0)] = 'OCTREE'), (t[(t.KDTREE = 1)] = 'KDTREE'));
      })(l || (l = {})),
      (function (t) {
        ((t[(t.FIXED = 0)] = 'FIXED'), (t[(t.ATTENUATED = 1)] = 'ATTENUATED'));
      })(u || (u = {})),
      (function (t) {
        ((t[(t.RGB = 0)] = 'RGB'),
          (t[(t.COLOR = 1)] = 'COLOR'),
          (t[(t.DEPTH = 2)] = 'DEPTH'),
          (t[(t.HEIGHT = 3)] = 'HEIGHT'),
          (t[(t.ELEVATION = 3)] = 'ELEVATION'),
          (t[(t.INTENSITY = 4)] = 'INTENSITY'),
          (t[(t.INTENSITY_GRADIENT = 5)] = 'INTENSITY_GRADIENT'),
          (t[(t.LOD = 6)] = 'LOD'),
          (t[(t.LEVEL_OF_DETAIL = 6)] = 'LEVEL_OF_DETAIL'),
          (t[(t.POINT_INDEX = 7)] = 'POINT_INDEX'),
          (t[(t.CLASSIFICATION = 8)] = 'CLASSIFICATION'),
          (t[(t.RETURN_NUMBER = 9)] = 'RETURN_NUMBER'),
          (t[(t.SOURCE = 10)] = 'SOURCE'),
          (t[(t.NORMAL = 11)] = 'NORMAL'),
          (t[(t.PHONG = 12)] = 'PHONG'),
          (t[(t.RGB_HEIGHT = 13)] = 'RGB_HEIGHT'),
          (t[(t.COMPOSITE = 50)] = 'COMPOSITE'));
      })(d || (d = {})),
      (function (t) {
        ((t[(t.ABSOLUTE_NORMAL_FILTERING_MODE = 1)] = 'ABSOLUTE_NORMAL_FILTERING_MODE'),
          (t[(t.LESS_EQUAL_NORMAL_FILTERING_MODE = 2)] = 'LESS_EQUAL_NORMAL_FILTERING_MODE'),
          (t[(t.GREATER_NORMAL_FILTERING_MODE = 3)] = 'GREATER_NORMAL_FILTERING_MODE'));
      })(c || (c = {})),
      (function (t) {
        ((t[(t.CHECKBOARD = 1)] = 'CHECKBOARD'), (t[(t.STRIPES = 2)] = 'STRIPES'));
      })(h || (h = {})));
    const m = 'PerspectiveCamera',
      g = new f.Color(0, 0, 0),
      A = new f.Vector4(1, 0, 0, 1);
    function v(t) {
      return parseInt(t.charAt(t.length - 1), 10);
    }
    function y(t, e) {
      const n = t.name,
        i = e.name;
      return n.length !== i.length ? n.length - i.length : n < i ? -1 : n > i ? 1 : 0;
    }
    function _(t) {
      if (200 !== t.status) throw Error('Response error');
      return t;
    }
    function b(t) {
      if (!t || 0 === t.byteLength) throw Error('Empty buffer');
      return t;
    }
    const x = {
        0: new f.Vector4(0.5, 0.5, 0.5, 1),
        1: new f.Vector4(0.5, 0.5, 0.5, 1),
        2: new f.Vector4(0.63, 0.32, 0.18, 1),
        3: new f.Vector4(0, 1, 0, 1),
        4: new f.Vector4(0, 0.8, 0, 1),
        5: new f.Vector4(0, 0.6, 0, 1),
        6: new f.Vector4(1, 0.66, 0, 1),
        7: new f.Vector4(1, 0, 1, 1),
        8: new f.Vector4(1, 0, 0, 1),
        9: new f.Vector4(0, 0, 1, 1),
        12: new f.Vector4(1, 1, 0, 1),
        DEFAULT: new f.Vector4(0.3, 0.6, 0.6, 0.5),
      },
      T = [
        [0, new f.Color(0, 0, 0)],
        [1, new f.Color(1, 1, 1)],
      ],
      w = [
        [0, new f.Color(0.077, 0.042, 0.206)],
        [0.1, new f.Color(0.225, 0.036, 0.388)],
        [0.2, new f.Color(0.373, 0.074, 0.432)],
        [0.3, new f.Color(0.522, 0.128, 0.42)],
        [0.4, new f.Color(0.665, 0.182, 0.37)],
        [0.5, new f.Color(0.797, 0.255, 0.287)],
        [0.6, new f.Color(0.902, 0.364, 0.184)],
        [0.7, new f.Color(0.969, 0.516, 0.063)],
        [0.8, new f.Color(0.988, 0.683, 0.072)],
        [0.9, new f.Color(0.961, 0.859, 0.298)],
        [1, new f.Color(0.988, 0.998, 0.645)],
      ],
      I = [
        [0, new f.Color(0.241, 0.015, 0.61)],
        [0.1, new f.Color(0.387, 0.001, 0.654)],
        [0.2, new f.Color(0.524, 0.025, 0.653)],
        [0.3, new f.Color(0.651, 0.125, 0.596)],
        [0.4, new f.Color(0.752, 0.227, 0.513)],
        [0.5, new f.Color(0.837, 0.329, 0.431)],
        [0.6, new f.Color(0.907, 0.435, 0.353)],
        [0.7, new f.Color(0.963, 0.554, 0.272)],
        [0.8, new f.Color(0.992, 0.681, 0.195)],
        [0.9, new f.Color(0.987, 0.822, 0.144)],
        [1, new f.Color(0.94, 0.975, 0.131)],
      ],
      N = [
        [0, new f.Color(0.278, 0, 0.714)],
        [1 / 6, new f.Color(0, 0, 1)],
        [2 / 6, new f.Color(0, 1, 1)],
        [0.5, new f.Color(0, 1, 0)],
        [4 / 6, new f.Color(1, 1, 0)],
        [5 / 6, new f.Color(1, 0.64, 0)],
        [1, new f.Color(1, 0, 0)],
      ],
      S = [
        [0, new f.Color(0.3686, 0.3098, 0.6353)],
        [0.1, new f.Color(0.1961, 0.5333, 0.7412)],
        [0.2, new f.Color(0.4, 0.7608, 0.6471)],
        [0.3, new f.Color(0.6706, 0.8667, 0.6431)],
        [0.4, new f.Color(0.902, 0.9608, 0.5961)],
        [0.5, new f.Color(1, 1, 0.749)],
        [0.6, new f.Color(0.9961, 0.8784, 0.5451)],
        [0.7, new f.Color(0.9922, 0.6824, 0.3804)],
        [0.8, new f.Color(0.9569, 0.4275, 0.2627)],
        [0.9, new f.Color(0.8353, 0.2431, 0.3098)],
        [1, new f.Color(0.6196, 0.0039, 0.2588)],
      ],
      C = [
        [0, new f.Color(0.267, 0.005, 0.329)],
        [0.1, new f.Color(0.283, 0.141, 0.458)],
        [0.2, new f.Color(0.254, 0.265, 0.53)],
        [0.3, new f.Color(0.207, 0.372, 0.553)],
        [0.4, new f.Color(0.164, 0.471, 0.558)],
        [0.5, new f.Color(0.128, 0.567, 0.551)],
        [0.6, new f.Color(0.135, 0.659, 0.518)],
        [0.7, new f.Color(0.267, 0.749, 0.441)],
        [0.8, new f.Color(0.478, 0.821, 0.318)],
        [0.9, new f.Color(0.741, 0.873, 0.15)],
        [1, new f.Color(0.993, 0.906, 0.144)],
      ],
      E = [
        [0, new f.Color(0.1647, 0.2824, 0.3451)],
        [0.1, new f.Color(0.1338, 0.3555, 0.4227)],
        [0.2, new f.Color(0.061, 0.4319, 0.4864)],
        [0.3, new f.Color(0, 0.5099, 0.5319)],
        [0.4, new f.Color(0, 0.5881, 0.5569)],
        [0.5, new f.Color(0.137, 0.665, 0.5614)],
        [0.6, new f.Color(0.2906, 0.7395, 0.5477)],
        [0.7, new f.Color(0.4453, 0.8099, 0.5201)],
        [0.8, new f.Color(0.6102, 0.8748, 0.485)],
        [0.9, new f.Color(0.7883, 0.9323, 0.4514)],
        [1, new f.Color(0.9804, 0.9804, 0.4314)],
      ];
    function P(t, e, n) {
      const i = t * e,
        r = new Uint8Array(4 * i),
        o = Math.floor(255 * n.r),
        s = Math.floor(255 * n.g),
        a = Math.floor(255 * n.b);
      for (let t = 0; t < i; t++) ((r[3 * t] = o), (r[3 * t + 1] = s), (r[3 * t + 2] = a));
      const l = new f.DataTexture(r, t, e, f.RGBAFormat);
      return ((l.needsUpdate = !0), (l.magFilter = f.NearestFilter), l);
    }
    function O(t) {
      const e = 64,
        n = document.createElement('canvas');
      ((n.width = e), (n.height = e));
      const i = n.getContext('2d');
      i.rect(0, 0, e, e);
      const r = i.createLinearGradient(0, 0, e, e);
      for (let e = 0; e < t.length; e++) {
        const n = t[e];
        r.addColorStop(n[0], `#${n[1].getHexString()}`);
      }
      ((i.fillStyle = r), i.fill());
      const o = new f.CanvasTexture(n);
      return ((o.needsUpdate = !0), (o.minFilter = f.LinearFilter), o);
    }
    function D(t) {
      const e = new Uint8Array(262144);
      for (let n = 0; n < 256; n++)
        for (let i = 0; i < 256; i++) {
          const r = n + 256 * i;
          let o;
          ((o = t[n] ? t[n] : t[n % 32] ? t[n % 32] : t.DEFAULT),
            (e[4 * r + 0] = 255 * o.x),
            (e[4 * r + 1] = 255 * o.y),
            (e[4 * r + 2] = 255 * o.z),
            (e[4 * r + 3] = 255 * o.w));
        }
      const n = new f.DataTexture(e, 256, 256, f.RGBAFormat);
      return ((n.magFilter = f.NearestFilter), (n.needsUpdate = !0), n);
    }
    var M = function (t, e, n, i) {
      var r,
        o = arguments.length,
        s = o < 3 ? e : null === i ? (i = Object.getOwnPropertyDescriptor(e, n)) : i;
      if ('object' == typeof Reflect && 'function' == typeof Reflect.decorate)
        s = Reflect.decorate(t, e, n, i);
      else
        for (var a = t.length - 1; a >= 0; a--)
          (r = t[a]) && (s = (o < 3 ? r(s) : o > 3 ? r(e, n, s) : r(e, n)) || s);
      return (o > 3 && s && Object.defineProperty(e, n, s), s);
    };
    const B = { [l.OCTREE]: 'tree_type_octree', [l.KDTREE]: 'tree_type_kdtree' },
      R = {
        [s.FIXED]: 'fixed_point_size',
        [s.ATTENUATED]: 'attenuated_point_size',
        [s.ADAPTIVE]: 'adaptive_point_size',
      },
      L = { [u.ATTENUATED]: 'attenuated_opacity', [u.FIXED]: 'fixed_opacity' },
      z = {
        [a.SQUARE]: 'square_point_shape',
        [a.CIRCLE]: 'circle_point_shape',
        [a.PARABOLOID]: 'paraboloid_point_shape',
      },
      F = {
        [d.RGB]: 'color_type_rgb',
        [d.COLOR]: 'color_type_color',
        [d.DEPTH]: 'color_type_depth',
        [d.HEIGHT]: 'color_type_height',
        [d.INTENSITY]: 'color_type_intensity',
        [d.INTENSITY_GRADIENT]: 'color_type_intensity_gradient',
        [d.LOD]: 'color_type_lod',
        [d.POINT_INDEX]: 'color_type_point_index',
        [d.CLASSIFICATION]: 'color_type_classification',
        [d.RETURN_NUMBER]: 'color_type_return_number',
        [d.SOURCE]: 'color_type_source',
        [d.NORMAL]: 'color_type_normal',
        [d.PHONG]: 'color_type_phong',
        [d.RGB_HEIGHT]: 'color_type_rgb_height',
        [d.COMPOSITE]: 'color_type_composite',
      },
      U = {
        [o.DISABLED]: 'clip_disabled',
        [o.CLIP_OUTSIDE]: 'clip_outside',
        [o.HIGHLIGHT_INSIDE]: 'clip_highlight_inside',
        [o.CLIP_HORIZONTALLY]: 'clip_horizontally',
        [o.CLIP_VERTICALLY]: 'clip_vertically',
        [o.CLIP_INSIDE]: 'clip_inside',
      };
    class V extends f.RawShaderMaterial {
      constructor(t = {}) {
        (super(),
          (this.useDrawingBufferSize = !1),
          (this.lights = !1),
          (this.fog = !1),
          (this.colorRgba = !1),
          (this.numClipBoxes = 0),
          (this.clipBoxes = []),
          (this.visibleNodeTextureOffsets = new Map()),
          (this._gradient = S),
          (this.gradientTexture = O(this._gradient)),
          (this._classification = x),
          (this.classificationTexture = D(this._classification)),
          (this.uniforms = {
            bbSize: G('fv', [0, 0, 0]),
            blendDepthSupplement: G('f', 0),
            blendHardness: G('f', 2),
            classificationLUT: G('t', this.classificationTexture || new f.Texture()),
            clipBoxCount: G('f', 0),
            clipBoxes: G('Matrix4fv', []),
            clipExtent: G('fv', [0, 0, 1, 1]),
            depthMap: G('t', null),
            diffuse: G('fv', [1, 1, 1]),
            fov: G('f', 1),
            gradient: G('t', this.gradientTexture || new f.Texture()),
            heightMax: G('f', 1),
            heightMin: G('f', 0),
            intensityBrightness: G('f', 0),
            intensityContrast: G('f', 0),
            intensityGamma: G('f', 1),
            intensityRange: G('fv', [0, 65e3]),
            isLeafNode: G('b', 0),
            level: G('f', 0),
            maxSize: G('f', 50),
            minSize: G('f', 2),
            octreeSize: G('f', 0),
            opacity: G('f', 1),
            pcIndex: G('f', 0),
            rgbBrightness: G('f', 0),
            rgbContrast: G('f', 0),
            rgbGamma: G('f', 1),
            screenHeight: G('f', 1),
            screenWidth: G('f', 1),
            size: G('f', 1),
            spacing: G('f', 1),
            toModel: G('Matrix4f', []),
            transition: G('f', 0.5),
            uColor: G('c', new f.Color(16777215)),
            visibleNodes: G('t', this.visibleNodesTexture || new f.Texture()),
            vnStart: G('f', 0),
            wClassification: G('f', 0),
            wElevation: G('f', 0),
            wIntensity: G('f', 0),
            wReturnNumber: G('f', 0),
            wRGB: G('f', 1),
            wSourceID: G('f', 0),
            opacityAttenuation: G('f', 1),
            filterByNormalThreshold: G('f', 0),
            highlightedPointCoordinate: G('fv', new f.Vector3()),
            highlightedPointColor: G('fv', A.clone()),
            enablePointHighlighting: G('b', !0),
            highlightedPointScale: G('f', 2),
            backgroundMap: G('t', null),
            normalFilteringMode: G('i', c.ABSOLUTE_NORMAL_FILTERING_MODE),
            pointCloudID: G('f', 2),
            pointCloudMixingMode: G('i', h.CHECKBOARD),
            stripeDistanceX: G('f', 5),
            stripeDistanceY: G('f', 5),
            stripeDivisorX: G('f', 2),
            stripeDivisorY: G('f', 2),
            pointCloudMixAngle: G('f', 31),
            renderDepth: G('bool', !1),
          }),
          (this.useClipBox = !1),
          (this.weighted = !1),
          (this.pointColorType = d.RGB),
          (this.pointSizeType = s.ADAPTIVE),
          (this.clipMode = o.DISABLED),
          (this.useEDL = !1),
          (this.shape = a.SQUARE),
          (this.treeType = l.OCTREE),
          (this.pointOpacityType = u.FIXED),
          (this.useFilterByNormal = !1),
          (this.useTextureBlending = !1),
          (this.usePointCloudMixing = !1),
          (this.highlightPoint = !1),
          (this.attributes = {
            position: { type: 'fv', value: [] },
            color: { type: 'fv', value: [] },
            normal: { type: 'fv', value: [] },
            intensity: { type: 'f', value: [] },
            classification: { type: 'f', value: [] },
            returnNumber: { type: 'f', value: [] },
            numberOfReturns: { type: 'f', value: [] },
            pointSourceID: { type: 'f', value: [] },
            indices: { type: 'fv', value: [] },
          }),
          (this.glslVersion = f.GLSL3));
        const e = (this.visibleNodesTexture = P(2048, 1, new f.Color(16777215)));
        ((e.minFilter = f.NearestFilter),
          (e.magFilter = f.NearestFilter),
          this.setUniform('visibleNodes', e),
          (this.treeType = H(t.treeType, l.OCTREE)),
          (this.size = H(t.size, 1)),
          (this.minSize = H(t.minSize, 2)),
          (this.maxSize = H(t.maxSize, 50)),
          (this.colorRgba = Boolean(t.colorRgba)),
          (this.classification = x),
          (this.defaultAttributeValues.normal = [0, 0, 0]),
          (this.defaultAttributeValues.classification = [0, 0, 0]),
          (this.defaultAttributeValues.indices = [0, 0, 0, 0]),
          (this.vertexColors = !0),
          this.updateShaderSource());
      }
      dispose() {
        (super.dispose(),
          this.gradientTexture && (this.gradientTexture.dispose(), (this.gradientTexture = void 0)),
          this.visibleNodesTexture &&
            (this.visibleNodesTexture.dispose(), (this.visibleNodesTexture = void 0)),
          this.clearVisibleNodeTextureOffsets(),
          this.classificationTexture &&
            (this.classificationTexture.dispose(), (this.classificationTexture = void 0)),
          this.depthMap && (this.depthMap.dispose(), (this.depthMap = void 0)),
          this.backgroundMap && (this.backgroundMap.dispose(), (this.backgroundMap = void 0)));
      }
      clearVisibleNodeTextureOffsets() {
        this.visibleNodeTextureOffsets.clear();
      }
      updateShaderSource() {
        ((this.vertexShader = this.applyDefines(i(29).A)),
          (this.fragmentShader = this.applyDefines(i(952).A)),
          1 === this.opacity
            ? ((this.blending = f.NoBlending),
              (this.transparent = !1),
              (this.depthTest = !0),
              (this.depthWrite = !0),
              (this.depthFunc = f.LessEqualDepth))
            : this.opacity < 1 &&
              !this.useEDL &&
              ((this.blending = f.AdditiveBlending),
              (this.transparent = !0),
              (this.depthTest = !1),
              (this.depthWrite = !0)),
          this.weighted &&
            ((this.blending = f.AdditiveBlending),
            (this.transparent = !0),
            (this.depthTest = !0),
            (this.depthWrite = !1),
            (this.depthFunc = f.LessEqualDepth)),
          (this.needsUpdate = !0));
      }
      applyDefines(t) {
        const e = [];
        function n(t) {
          t && e.push(`#define ${t}`);
        }
        return (
          n(B[this.treeType]),
          n(R[this.pointSizeType]),
          n(z[this.shape]),
          n(F[this.pointColorType]),
          n(U[this.clipMode]),
          n(L[this.pointOpacityType]),
          (1 === this.rgbGamma && 0 === this.rgbBrightness && 0 === this.rgbContrast) ||
            n('use_rgb_gamma_contrast_brightness'),
          this.useFilterByNormal && n('use_filter_by_normal'),
          this.useEDL && n('use_edl'),
          this.weighted && n('weighted_splats'),
          this.numClipBoxes > 0 && n('use_clip_box'),
          this.highlightPoint && n('highlight_point'),
          this.useTextureBlending && n('use_texture_blending'),
          this.usePointCloudMixing && n('use_point_cloud_mixing'),
          this.colorRgba && n('color_rgba'),
          n('MAX_POINT_LIGHTS 0'),
          n('MAX_DIR_LIGHTS 0'),
          e.push(t),
          e.join('\n')
        );
      }
      setPointCloudMixingMode(t) {
        this.pointCloudMixingMode = t;
      }
      getPointCloudMixingMode() {
        return this.pointCloudMixingMode === h.STRIPES ? h.STRIPES : h.CHECKBOARD;
      }
      setClipBoxes(t) {
        if (!t) return;
        this.clipBoxes = t;
        const e = this.numClipBoxes !== t.length && (0 === t.length || 0 === this.numClipBoxes);
        ((this.numClipBoxes = t.length),
          this.setUniform('clipBoxCount', this.numClipBoxes),
          e && this.updateShaderSource());
        const n = 16 * this.numClipBoxes,
          i = new Float32Array(n);
        for (let e = 0; e < this.numClipBoxes; e++) i.set(t[e].inverse.elements, 16 * e);
        for (let t = 0; t < n; t++) isNaN(i[t]) && (i[t] = 1 / 0);
        this.setUniform('clipBoxes', i);
      }
      get gradient() {
        return this._gradient;
      }
      set gradient(t) {
        this._gradient !== t &&
          ((this._gradient = t),
          (this.gradientTexture = O(this._gradient)),
          this.setUniform('gradient', this.gradientTexture));
      }
      get classification() {
        return this._classification;
      }
      set classification(t) {
        const e = {};
        for (const n of Object.keys(t)) e[n] = t[n].clone();
        let n = !1;
        if (void 0 === this._classification) n = !1;
        else {
          n = Object.keys(e).length === Object.keys(this._classification).length;
          for (const t of Object.keys(e))
            ((n = n && void 0 !== this._classification[t]),
              (n = n && e[t].equals(this._classification[t])));
        }
        n || ((this._classification = e), this.recomputeClassification());
      }
      recomputeClassification() {
        ((this.classificationTexture = D(this._classification)),
          this.setUniform('classificationLUT', this.classificationTexture));
      }
      get elevationRange() {
        return [this.heightMin, this.heightMax];
      }
      set elevationRange(t) {
        ((this.heightMin = t[0]), (this.heightMax = t[1]));
      }
      getUniform(t) {
        return void 0 === this.uniforms ? void 0 : this.uniforms[t].value;
      }
      setUniform(t, e) {
        if (void 0 === this.uniforms) return;
        const n = this.uniforms[t];
        'c' === n.type ? n.value.copy(e) : e !== n.value && (n.value = e);
      }
      updateMaterial(t, e, n, i) {
        const r = i.getPixelRatio();
        n.type === m ? (this.fov = n.fov * (Math.PI / 180)) : (this.fov = Math.PI / 2);
        const o = i.getRenderTarget();
        (null !== o
          ? ((this.screenWidth = o.width), (this.screenHeight = o.height))
          : ((this.screenWidth = i.domElement.clientWidth * r),
            (this.screenHeight = i.domElement.clientHeight * r)),
          this.useDrawingBufferSize &&
            (i.getDrawingBufferSize(V.helperVec2),
            (this.screenWidth = V.helperVec2.width),
            (this.screenHeight = V.helperVec2.height)));
        const a = Math.max(t.scale.x, t.scale.y, t.scale.z);
        ((this.spacing = t.pcoGeometry.spacing * a),
          (this.octreeSize = t.pcoGeometry.boundingBox.getSize(V.helperVec3).x),
          (this.pointSizeType !== s.ADAPTIVE && this.pointColorType !== d.LOD) ||
            this.updateVisibilityTextureData(e));
      }
      updateVisibilityTextureData(t) {
        t.sort(y);
        const e = new Uint8Array(4 * t.length),
          n = new Array(t.length).fill(1 / 0);
        this.visibleNodeTextureOffsets.clear();
        for (let i = 0; i < t.length; i++) {
          const r = t[i];
          if ((this.visibleNodeTextureOffsets.set(r.name, i), i > 0)) {
            const t = r.name.slice(0, -1),
              o = this.visibleNodeTextureOffsets.get(t),
              s = i - o;
            n[o] = Math.min(n[o], s);
            const a = 4 * o;
            ((e[a] = e[a] | (1 << r.index)), (e[a + 1] = n[o] >> 8), (e[a + 2] = n[o] % 256));
          }
          e[4 * i + 3] = r.name.length;
        }
        const i = this.visibleNodesTexture;
        i && (i.image.data.set(e), (i.needsUpdate = !0));
      }
      static makeOnBeforeRender(t, e, n) {
        return (i, r, o, s, a) => {
          const l = a,
            u = l.uniforms;
          ((u.level.value = e.level), (u.isLeafNode.value = e.isLeafNode));
          const d = l.visibleNodeTextureOffsets.get(e.name);
          (void 0 !== d && (u.vnStart.value = d),
            (u.pcIndex.value = void 0 !== n ? n : t.visibleNodes.indexOf(e)),
            (a.uniformsNeedUpdate = !0));
        };
      }
    }
    function G(t, e) {
      return { type: t, value: e };
    }
    function H(t, e) {
      return void 0 === t ? e : t;
    }
    function Y(t, e = !1) {
      return (n, i) => {
        Object.defineProperty(n, i, {
          get() {
            return this.getUniform(t);
          },
          set(n) {
            n !== this.getUniform(t) && (this.setUniform(t, n), e && this.updateShaderSource());
          },
        });
      };
    }
    function k() {
      return (t, e) => {
        const n = `_${e.toString()}`;
        Object.defineProperty(t, e, {
          get() {
            return this[n];
          },
          set(t) {
            t !== this[n] && ((this[n] = t), this.updateShaderSource());
          },
        });
      };
    }
    var W;
    ((V.helperVec3 = new f.Vector3()),
      (V.helperVec2 = new f.Vector2()),
      M([Y('bbSize')], V.prototype, 'bbSize', void 0),
      M([Y('clipExtent')], V.prototype, 'clipExtent', void 0),
      M([Y('depthMap')], V.prototype, 'depthMap', void 0),
      M([Y('fov')], V.prototype, 'fov', void 0),
      M([Y('heightMax')], V.prototype, 'heightMax', void 0),
      M([Y('heightMin')], V.prototype, 'heightMin', void 0),
      M([Y('intensityBrightness')], V.prototype, 'intensityBrightness', void 0),
      M([Y('intensityContrast')], V.prototype, 'intensityContrast', void 0),
      M([Y('intensityGamma')], V.prototype, 'intensityGamma', void 0),
      M([Y('intensityRange')], V.prototype, 'intensityRange', void 0),
      M([Y('maxSize')], V.prototype, 'maxSize', void 0),
      M([Y('minSize')], V.prototype, 'minSize', void 0),
      M([Y('octreeSize')], V.prototype, 'octreeSize', void 0),
      M([Y('opacity', !0)], V.prototype, 'opacity', void 0),
      M([Y('rgbBrightness', !0)], V.prototype, 'rgbBrightness', void 0),
      M([Y('rgbContrast', !0)], V.prototype, 'rgbContrast', void 0),
      M([Y('rgbGamma', !0)], V.prototype, 'rgbGamma', void 0),
      M([Y('screenHeight')], V.prototype, 'screenHeight', void 0),
      M([Y('screenWidth')], V.prototype, 'screenWidth', void 0),
      M([Y('size')], V.prototype, 'size', void 0),
      M([Y('spacing')], V.prototype, 'spacing', void 0),
      M([Y('transition')], V.prototype, 'transition', void 0),
      M([Y('uColor')], V.prototype, 'color', void 0),
      M([Y('wClassification')], V.prototype, 'weightClassification', void 0),
      M([Y('wElevation')], V.prototype, 'weightElevation', void 0),
      M([Y('wIntensity')], V.prototype, 'weightIntensity', void 0),
      M([Y('wReturnNumber')], V.prototype, 'weightReturnNumber', void 0),
      M([Y('wRGB')], V.prototype, 'weightRGB', void 0),
      M([Y('wSourceID')], V.prototype, 'weightSourceID', void 0),
      M([Y('opacityAttenuation')], V.prototype, 'opacityAttenuation', void 0),
      M([Y('filterByNormalThreshold')], V.prototype, 'filterByNormalThreshold', void 0),
      M([Y('highlightedPointCoordinate')], V.prototype, 'highlightedPointCoordinate', void 0),
      M([Y('highlightedPointColor')], V.prototype, 'highlightedPointColor', void 0),
      M([Y('enablePointHighlighting')], V.prototype, 'enablePointHighlighting', void 0),
      M([Y('highlightedPointScale')], V.prototype, 'highlightedPointScale', void 0),
      M([Y('normalFilteringMode')], V.prototype, 'normalFilteringMode', void 0),
      M([Y('backgroundMap')], V.prototype, 'backgroundMap', void 0),
      M([Y('pointCloudID')], V.prototype, 'pointCloudID', void 0),
      M([Y('pointCloudMixingMode')], V.prototype, 'pointCloudMixingMode', void 0),
      M([Y('stripeDistanceX')], V.prototype, 'stripeDistanceX', void 0),
      M([Y('stripeDistanceY')], V.prototype, 'stripeDistanceY', void 0),
      M([Y('stripeDivisorX')], V.prototype, 'stripeDivisorX', void 0),
      M([Y('stripeDivisorY')], V.prototype, 'stripeDivisorY', void 0),
      M([Y('pointCloudMixAngle')], V.prototype, 'pointCloudMixAngle', void 0),
      M([Y('renderDepth')], V.prototype, 'renderDepth', void 0),
      M([k()], V.prototype, 'useClipBox', void 0),
      M([k()], V.prototype, 'weighted', void 0),
      M([k()], V.prototype, 'pointColorType', void 0),
      M([k()], V.prototype, 'pointSizeType', void 0),
      M([k()], V.prototype, 'clipMode', void 0),
      M([k()], V.prototype, 'useEDL', void 0),
      M([k()], V.prototype, 'shape', void 0),
      M([k()], V.prototype, 'treeType', void 0),
      M([k()], V.prototype, 'pointOpacityType', void 0),
      M([k()], V.prototype, 'useFilterByNormal', void 0),
      M([k()], V.prototype, 'useTextureBlending', void 0),
      M([k()], V.prototype, 'usePointCloudMixing', void 0),
      M([k()], V.prototype, 'highlightPoint', void 0),
      (function (t) {
        ((t[(t.POSITION_CARTESIAN = 0)] = 'POSITION_CARTESIAN'),
          (t[(t.COLOR_PACKED = 1)] = 'COLOR_PACKED'),
          (t[(t.COLOR_FLOATS_1 = 2)] = 'COLOR_FLOATS_1'),
          (t[(t.COLOR_FLOATS_255 = 3)] = 'COLOR_FLOATS_255'),
          (t[(t.NORMAL_FLOATS = 4)] = 'NORMAL_FLOATS'),
          (t[(t.FILLER = 5)] = 'FILLER'),
          (t[(t.INTENSITY = 6)] = 'INTENSITY'),
          (t[(t.CLASSIFICATION = 7)] = 'CLASSIFICATION'),
          (t[(t.NORMAL_SPHEREMAPPED = 8)] = 'NORMAL_SPHEREMAPPED'),
          (t[(t.NORMAL_OCT16 = 9)] = 'NORMAL_OCT16'),
          (t[(t.NORMAL = 10)] = 'NORMAL'));
      })(W || (W = {})));
    const j = {
      DATA_TYPE_DOUBLE: { ordinal: 0, size: 8 },
      DATA_TYPE_FLOAT: { ordinal: 1, size: 4 },
      DATA_TYPE_INT8: { ordinal: 2, size: 1 },
      DATA_TYPE_UINT8: { ordinal: 3, size: 1 },
      DATA_TYPE_INT16: { ordinal: 4, size: 2 },
      DATA_TYPE_UINT16: { ordinal: 5, size: 2 },
      DATA_TYPE_INT32: { ordinal: 6, size: 4 },
      DATA_TYPE_UINT32: { ordinal: 7, size: 4 },
      DATA_TYPE_INT64: { ordinal: 8, size: 8 },
      DATA_TYPE_UINT64: { ordinal: 9, size: 8 },
    };
    function K(t, e, n) {
      return { name: t, type: e, numElements: n, byteSize: n * e.size };
    }
    const X = K(W.COLOR_PACKED, j.DATA_TYPE_INT8, 4),
      q = {
        POSITION_CARTESIAN: K(W.POSITION_CARTESIAN, j.DATA_TYPE_FLOAT, 3),
        RGBA_PACKED: X,
        COLOR_PACKED: X,
        RGB_PACKED: K(W.COLOR_PACKED, j.DATA_TYPE_INT8, 3),
        NORMAL_FLOATS: K(W.NORMAL_FLOATS, j.DATA_TYPE_FLOAT, 3),
        FILLER_1B: K(W.FILLER, j.DATA_TYPE_UINT8, 1),
        INTENSITY: K(W.INTENSITY, j.DATA_TYPE_UINT16, 1),
        CLASSIFICATION: K(W.CLASSIFICATION, j.DATA_TYPE_UINT8, 1),
        NORMAL_SPHEREMAPPED: K(W.NORMAL_SPHEREMAPPED, j.DATA_TYPE_UINT8, 2),
        NORMAL_OCT16: K(W.NORMAL_OCT16, j.DATA_TYPE_UINT8, 2),
        NORMAL: K(W.NORMAL, j.DATA_TYPE_FLOAT, 3),
      };
    class Q {
      constructor(t = []) {
        ((this.attributes = []), (this.byteSize = 0), (this.size = 0));
        for (let e = 0; e < t.length; e++) {
          const n = t[e],
            i = q[n];
          (this.attributes.push(i), (this.byteSize += i.byteSize), this.size++);
        }
      }
      add(t) {
        (this.attributes.push(t), (this.byteSize += t.byteSize), this.size++);
      }
      hasColors() {
        return void 0 !== this.attributes.find($);
      }
      hasNormals() {
        return void 0 !== this.attributes.find(Z);
      }
    }
    function $({ name: t }) {
      return t === W.COLOR_PACKED;
    }
    function Z({ name: t }) {
      return (
        t === W.NORMAL_SPHEREMAPPED ||
        t === W.NORMAL_FLOATS ||
        t === W.NORMAL ||
        t === W.NORMAL_OCT16
      );
    }
    function J(t, e) {
      return new f.Box3().setFromPoints([
        new f.Vector3(t.min.x, t.min.y, t.min.z).applyMatrix4(e),
        new f.Vector3(t.min.x, t.min.y, t.min.z).applyMatrix4(e),
        new f.Vector3(t.max.x, t.min.y, t.min.z).applyMatrix4(e),
        new f.Vector3(t.min.x, t.max.y, t.min.z).applyMatrix4(e),
        new f.Vector3(t.min.x, t.min.y, t.max.z).applyMatrix4(e),
        new f.Vector3(t.min.x, t.max.y, t.max.z).applyMatrix4(e),
        new f.Vector3(t.max.x, t.max.y, t.min.z).applyMatrix4(e),
        new f.Vector3(t.max.x, t.min.y, t.max.z).applyMatrix4(e),
        new f.Vector3(t.max.x, t.max.y, t.max.z).applyMatrix4(e),
      ]);
    }
    function tt(t, e) {
      const n = t.min.clone(),
        i = t.max.clone(),
        r = new f.Vector3().subVectors(i, n);
      return (
        (1 & e) > 0 ? (n.z += r.z / 2) : (i.z -= r.z / 2),
        (2 & e) > 0 ? (n.y += r.y / 2) : (i.y -= r.y / 2),
        (4 & e) > 0 ? (n.x += r.x / 2) : (i.x -= r.x / 2),
        new f.Box3(n, i)
      );
    }
    class et extends f.EventDispatcher {
      constructor(t, e, n) {
        (super(),
          (this.id = et.idCount++),
          (this.level = 0),
          (this.spacing = 0),
          (this.hasChildren = !1),
          (this.children = [null, null, null, null, null, null, null, null]),
          (this.mean = new f.Vector3()),
          (this.numPoints = 0),
          (this.loaded = !1),
          (this.loading = !1),
          (this.failed = !1),
          (this.parent = null),
          (this.oneTimeDisposeHandlers = []),
          (this.isLeafNode = !0),
          (this.isTreeNode = !1),
          (this.isGeometryNode = !0),
          (this.name = t),
          (this.index = v(t)),
          (this.pcoGeometry = e),
          (this.boundingBox = n),
          (this.tightBoundingBox = n.clone()),
          (this.boundingSphere = n.getBoundingSphere(new f.Sphere())));
      }
      dispose() {
        this.geometry &&
          this.parent &&
          (this.geometry.dispose(),
          (this.geometry = void 0),
          (this.loaded = !1),
          this.oneTimeDisposeHandlers.forEach((t) => t()),
          (this.oneTimeDisposeHandlers = []));
      }
      getUrl() {
        const t = this.pcoGeometry,
          e = t.loader.version,
          n = [t.octreeDir];
        return (
          t.loader && e.equalOrHigher('1.5')
            ? (n.push(this.getHierarchyBaseUrl()), n.push(this.name))
            : (e.equalOrHigher('1.4') || e.upTo('1.3')) && n.push(this.name),
          n.join('/')
        );
      }
      getHierarchyUrl() {
        return `${this.pcoGeometry.octreeDir}/${this.getHierarchyBaseUrl()}/${this.name}.hrc`;
      }
      addChild(t) {
        ((this.children[t.index] = t), (this.isLeafNode = !1), (t.parent = this));
      }
      traverse(t, e = !0) {
        const n = e ? [this] : [];
        let i;
        for (; void 0 !== (i = n.pop()); ) {
          t(i);
          for (const t of i.children) null !== t && n.push(t);
        }
      }
      load() {
        if (!this.canLoad()) return Promise.resolve();
        let t;
        return (
          (this.loading = !0),
          this.pcoGeometry.numNodesLoading++,
          (this.pcoGeometry.needsUpdate = !0),
          (t =
            this.pcoGeometry.loader.version.equalOrHigher('1.5') &&
            this.level % this.pcoGeometry.hierarchyStepSize === 0 &&
            this.hasChildren
              ? this.loadHierachyThenPoints()
              : this.loadPoints()),
          t.catch((t) => {
            throw ((this.loading = !1), (this.failed = !0), this.pcoGeometry.numNodesLoading--, t);
          })
        );
      }
      canLoad() {
        return (
          !this.loading &&
          !this.loaded &&
          !this.pcoGeometry.disposed &&
          !this.pcoGeometry.loader.disposed &&
          this.pcoGeometry.numNodesLoading < this.pcoGeometry.maxNumNodesLoading
        );
      }
      loadPoints() {
        return ((this.pcoGeometry.needsUpdate = !0), this.pcoGeometry.loader.load(this));
      }
      loadHierachyThenPoints() {
        return this.level % this.pcoGeometry.hierarchyStepSize !== 0
          ? Promise.resolve()
          : Promise.resolve(this.pcoGeometry.loader.getUrl(this.getHierarchyUrl()))
              .then((t) => this.pcoGeometry.xhrRequest(t, { mode: 'cors' }))
              .then((t) => _(t))
              .then((t) => t.arrayBuffer())
              .then((t) => b(t))
              .then((t) => this.loadHierarchy(this, t));
      }
      getHierarchyBaseUrl() {
        const t = this.pcoGeometry.hierarchyStepSize,
          e = this.name.substr(1),
          n = Math.floor(e.length / t);
        let i = 'r/';
        for (let r = 0; r < n; r++) i += `${e.substr(r * t, t)}/`;
        return i.slice(0, -1);
      }
      loadHierarchy(t, e) {
        const n = new DataView(e),
          i = this.getNodeData(t.name, 0, n);
        t.numPoints = i.numPoints;
        const r = [i],
          o = [];
        let s = 5;
        for (; r.length > 0; ) {
          const t = r.shift();
          let i = 1;
          for (let a = 0; a < 8 && s + 1 < e.byteLength; a++) {
            if (0 !== (t.children & i)) {
              const e = this.getNodeData(t.name + a, s, n);
              (o.push(e), r.push(e), (s += 5));
            }
            i *= 2;
          }
        }
        t.pcoGeometry.needsUpdate = !0;
        const a = new Map();
        (a.set(t.name, t), o.forEach((e) => this.addNode(e, t.pcoGeometry, a)), t.loadPoints());
      }
      getNodeData(t, e, n) {
        return { children: n.getUint8(e), numPoints: n.getUint32(e + 1, !0), name: t };
      }
      addNode({ name: t, numPoints: e, children: n }, i, r) {
        const o = v(t),
          s = t.substring(0, t.length - 1),
          a = r.get(s),
          l = t.length - 1,
          u = tt(a.boundingBox, o),
          d = new et(t, i, u);
        ((d.level = l),
          (d.numPoints = e),
          (d.hasChildren = n > 0),
          (d.spacing = i.spacing / Math.pow(2, l)),
          a.addChild(d),
          r.set(t, d));
      }
    }
    et.idCount = 0;
    class nt {
      constructor(t, e, n, i, r) {
        ((this.loader = t),
          (this.boundingBox = e),
          (this.tightBoundingBox = n),
          (this.offset = i),
          (this.xhrRequest = r),
          (this.disposed = !1),
          (this.needsUpdate = !0),
          (this.octreeDir = ''),
          (this.hierarchyStepSize = -1),
          (this.nodes = {}),
          (this.numNodesLoading = 0),
          (this.maxNumNodesLoading = 3),
          (this.spacing = 0),
          (this.pointAttributes = new Q([])),
          (this.projection = null),
          (this.url = null));
      }
      dispose() {
        (this.loader.dispose(), this.root.traverse((t) => t.dispose()), (this.disposed = !0));
      }
      addNodeLoadedCallback(t) {
        this.loader.callbacks.push(t);
      }
      clearNodeLoadedCallbacks() {
        this.loader.callbacks = [];
      }
    }
    class it extends f.EventDispatcher {
      constructor(t, e) {
        (super(),
          (this.pcIndex = void 0),
          (this.boundingBoxNode = null),
          (this.loaded = !0),
          (this.isTreeNode = !0),
          (this.isGeometryNode = !1),
          (this.geometryNode = t),
          (this.sceneNode = e),
          (this.children = t.children.slice()));
      }
      dispose() {
        this.geometryNode.dispose();
      }
      disposeSceneNode() {
        const t = this.sceneNode;
        if (t.geometry instanceof f.BufferGeometry) {
          const e = t.geometry.attributes;
          for (const t in e) (delete e[t].array, delete e[t]);
          (t.geometry.dispose(), (t.geometry = void 0));
        }
      }
      traverse(t, e) {
        this.geometryNode.traverse(t, e);
      }
      get id() {
        return this.geometryNode.id;
      }
      get name() {
        return this.geometryNode.name;
      }
      get level() {
        return this.geometryNode.level;
      }
      get isLeafNode() {
        return this.geometryNode.isLeafNode;
      }
      get numPoints() {
        return this.geometryNode.numPoints;
      }
      get index() {
        return this.geometryNode.index;
      }
      get boundingSphere() {
        return this.geometryNode.boundingSphere;
      }
      get boundingBox() {
        return this.geometryNode.boundingBox;
      }
      get spacing() {
        return this.geometryNode.spacing;
      }
    }
    function rt(t, e, n) {
      return Math.min(Math.max(e, t), n);
    }
    class ot {
      dispose() {
        this.pickState &&
          (this.pickState.material.dispose(), this.pickState.renderTarget.dispose());
      }
      pick(t, e, n, i, r = {}) {
        if (0 === i.length) return null;
        const o = this.pickState ? this.pickState : (this.pickState = ot.getPickState()),
          s = o.material,
          a = t.getPixelRatio(),
          l = Math.ceil(t.domElement.clientWidth * a),
          u = Math.ceil(t.domElement.clientHeight * a);
        ot.updatePickRenderTarget(this.pickState, l, u);
        const d = ot.helperVec3;
        r.pixelPosition
          ? d.copy(r.pixelPosition)
          : (d.addVectors(n.origin, n.direction).project(e),
            (d.x = (d.x + 1) * l * 0.5),
            (d.y = (d.y + 1) * u * 0.5));
        const c = Math.floor((r.pickWindowSize || 15) * a),
          h = (c - 1) / 2,
          f = Math.floor(rt(d.x - h, 0, l)),
          p = Math.floor(rt(d.y - h, 0, u));
        ot.prepareRender(t, f, p, c, s, o);
        const m = ot.render(t, e, s, i, n, o, r);
        s.clearVisibleNodeTextureOffsets();
        const g = ot.readPixels(t, f, p, c),
          A = ot.findHit(g, c);
        return ot.getPickPoint(A, m);
      }
      static prepareRender(t, e, n, i, r, o) {
        (t.setScissor(e, n, i, i),
          t.setScissorTest(!0),
          t.state.buffers.depth.setTest(r.depthTest),
          t.state.buffers.depth.setMask(r.depthWrite),
          t.state.setBlending(f.NoBlending),
          t.setRenderTarget(o.renderTarget),
          t.getClearColor(this.clearColor));
        const s = t.getClearAlpha();
        (t.setClearColor(g, 0), t.clear(!0, !0, !0), t.setClearColor(this.clearColor, s));
      }
      static render(t, e, n, i, r, o, s) {
        const a = [];
        for (const l of i) {
          const i = ot.nodesOnRay(l, r);
          i.length &&
            (ot.updatePickMaterial(n, l.material, s),
            n.updateMaterial(l, i, e, t),
            s.onBeforePickRender && s.onBeforePickRender(n, o.renderTarget),
            (o.scene.children = ot.createTempNodes(l, i, n, a.length)),
            t.render(o.scene, e),
            i.forEach((t) => a.push({ node: t, octree: l })));
        }
        return a;
      }
      static nodesOnRay(t, e) {
        const n = [],
          i = e.clone();
        for (const e of t.visibleNodes) {
          const r = ot.helperSphere.copy(e.boundingSphere).applyMatrix4(t.matrixWorld);
          i.intersectsSphere(r) && n.push(e);
        }
        return n;
      }
      static readPixels(t, e, n, i) {
        const r = new Uint8Array(4 * i * i);
        return (
          t.readRenderTargetPixels(t.getRenderTarget(), e, n, i, i, r),
          t.setScissorTest(!1),
          t.setRenderTarget(null),
          r
        );
      }
      static createTempNodes(t, e, n, i) {
        const r = [];
        for (let o = 0; o < e.length; o++) {
          const s = e[o],
            a = s.sceneNode,
            l = new f.Points(a.geometry, n);
          ((l.matrix = a.matrix),
            (l.matrixWorld = a.matrixWorld),
            (l.matrixAutoUpdate = !1),
            (l.frustumCulled = !1));
          const u = i + o + 1;
          (u > 255 && console.error('More than 255 nodes for pick are not supported.'),
            (l.onBeforeRender = V.makeOnBeforeRender(t, s, u)),
            r.push(l));
        }
        return r;
      }
      static updatePickMaterial(t, e, n) {
        ((t.pointSizeType = e.pointSizeType),
          (t.shape = e.shape),
          (t.size = e.size),
          (t.minSize = e.minSize),
          (t.maxSize = e.maxSize),
          (t.classification = e.classification),
          (t.useFilterByNormal = e.useFilterByNormal),
          (t.filterByNormalThreshold = e.filterByNormalThreshold),
          n.pickOutsideClipRegion
            ? (t.clipMode = o.DISABLED)
            : ((t.clipMode = e.clipMode),
              (t.clipExtent = e.clipExtent),
              t.setClipBoxes(e.clipMode === o.CLIP_OUTSIDE ? e.clipBoxes : [])));
      }
      static updatePickRenderTarget(t, e, n) {
        (t.renderTarget.width === e && t.renderTarget.height === n) ||
          (t.renderTarget.dispose(),
          (t.renderTarget = ot.makePickRenderTarget()),
          t.renderTarget.setSize(e, n));
      }
      static makePickRenderTarget() {
        return new f.WebGLRenderTarget(1, 1, {
          minFilter: f.LinearFilter,
          magFilter: f.NearestFilter,
          format: f.RGBAFormat,
        });
      }
      static findHit(t, e) {
        const n = new Uint32Array(t.buffer);
        let i = Number.MAX_VALUE,
          r = null;
        for (let o = 0; o < e; o++)
          for (let s = 0; s < e; s++) {
            const a = o + s * e,
              l = Math.pow(o - (e - 1) / 2, 2) + Math.pow(s - (e - 1) / 2, 2),
              u = t[4 * a + 3];
            t[4 * a + 3] = 0;
            const d = n[a];
            u > 0 && l < i && ((r = { pIndex: d, pcIndex: u - 1 }), (i = l));
          }
        return r;
      }
      static getPickPoint(t, e) {
        if (!t) return null;
        const n = {},
          i = e[t.pcIndex] && e[t.pcIndex].node.sceneNode;
        if (!i) return null;
        n.pointCloud = e[t.pcIndex].octree;
        const r = i.geometry.attributes;
        for (const e in r) {
          if (!r.hasOwnProperty(e)) continue;
          const o = r[e];
          if ('position' === e) ot.addPositionToPickPoint(n, t, o, i);
          else if ('normal' === e) ot.addNormalToPickPoint(n, t, o, i);
          else if ('indices' === e);
          else if (1 === o.itemSize) n[e] = o.array[t.pIndex];
          else {
            const i = [];
            for (let e = 0; e < o.itemSize; e++) i.push(o.array[o.itemSize * t.pIndex + e]);
            n[e] = i;
          }
        }
        return n;
      }
      static addPositionToPickPoint(t, e, n, i) {
        t.position = new f.Vector3().fromBufferAttribute(n, e.pIndex).applyMatrix4(i.matrixWorld);
      }
      static addNormalToPickPoint(t, e, n, i) {
        const r = new f.Vector3().fromBufferAttribute(n, e.pIndex),
          o = new f.Vector4(r.x, r.y, r.z, 0).applyMatrix4(i.matrixWorld);
        (r.set(o.x, o.y, o.z), (t.normal = r));
      }
      static getPickState() {
        const t = new f.Scene();
        t.matrixAutoUpdate = !1;
        const e = new V();
        return (
          (e.pointColorType = d.POINT_INDEX),
          { renderTarget: ot.makePickRenderTarget(), material: e, scene: t }
        );
      }
    }
    ((ot.helperVec3 = new f.Vector3()),
      (ot.helperSphere = new f.Sphere()),
      (ot.clearColor = new f.Color()));
    class st {
      constructor(t, e) {
        ((this.loader = t),
          (this.boundingBox = e),
          (this.maxNumNodesLoading = 3),
          (this.numNodesLoading = 0),
          (this.needsUpdate = !0),
          (this.disposed = !1),
          (this.pointAttributes = null),
          (this.spacing = 0),
          (this.url = null),
          (this.tightBoundingBox = this.boundingBox.clone()),
          (this.boundingSphere = this.boundingBox.getBoundingSphere(new f.Sphere())),
          (this.tightBoundingSphere = this.boundingSphere.clone()));
      }
      dispose() {
        (this.root.traverse((t) => t.dispose()), (this.disposed = !0));
      }
    }
    class at extends f.Object3D {
      constructor() {
        (super(...arguments), (this.root = null));
      }
      initialized() {
        return null !== this.root;
      }
    }
    function lt(t) {
      function e(t) {
        return t.charCodeAt(0);
      }
      let n,
        i,
        r,
        o,
        s,
        a,
        l,
        u,
        d,
        c,
        h,
        f = 65536;
      t.onmessage = (p) => {
        (p.data.init &&
          (function (c) {
            r = c;
            const f = 4 * r,
              p = 16 * r,
              m = 4 * r,
              g = 524288,
              A = f + p + 64 + m + g + 4 * r + 2097152,
              v = Math.floor(A / 65536) + 1,
              y = {
                module: {},
                env: { memory: new WebAssembly.Memory({ initial: v, maximum: v }) },
              },
              _ = new Uint8Array(
                atob(
                  'AGFzbQEAAAAADwhkeWxpbmsuMAEEAAAAAAEPAmAAAGAIf39/f39/f38AAg8BA2VudgZtZW1vcnkCAAADAwIAAQcjAhFfX3dhc21fY2FsbF9jdG9ycwAAC3NvcnRJbmRleGVzAAEKhgMCAwABC/8CAgN/A30gBwRAIAQqAighCyAEKgIYIQwgBCoCCCENQfj///8HIQlBiICAgHghBANAIAIgCkECdCIIaiALIAEgACAIaigCAEEEdGoiCCoCCJQgDSAIKgIAlCAMIAgqAgSUkpJDAACARZT8ACIINgIAIAkgCCAIIAlKGyEJIAQgCCAEIAhKGyEEIApBAWoiCiAHRw0ACyAGQQFrsyAEsiAJspOVIQtBACEEA0AgAiAEQQJ0aiIBIAsgASgCACAJa7KU/AAiATYCACADIAFBAnRqIgEgASgCAEEBajYCACAEQQFqIgQgB0cNAAsLIAZBAk8EQCADKAIAIQlBASEEA0AgAyAEQQJ0aiIBIAEoAgAgCWoiCTYCACAEQQFqIgQgBkcNAAsLIAdBAEoEQCAHIQQDQCAFIAcgAyACIARBAWsiAUECdCIGaigCAEECdGoiCSgCACIIa0ECdGogACAGaigCADYCACAJIAhBAWs2AgAgBEEBSyEGIAEhBCAGDQALCws=',
                )
                  .split('')
                  .map(e),
              );
            WebAssembly.instantiate(_, y).then((e) => {
              ((n = e.instance), (i = y.env.memory.buffer), (h = new Int32Array(r)));
              for (let t = 0; t < r; t++) h[t] = t;
              ((o = 0),
                (u = o + f),
                (d = u + p),
                (a = d + 64),
                (l = a + m),
                (s = l + g),
                t.postMessage({ sorterReady: !0 }));
            });
          })(p.data.splatCount),
          p.data.sort &&
            (function (e) {
              let r = e.data.sort.centers,
                h = e.data.sort.totalSplats,
                p = e.data.sort.modelViewProj;
              (new Float32Array(i, u, r.byteLength / 4).set(new Float32Array(r)),
                new Int32Array(i, 0, e.data.sort.indices.byteLength / 4).set(e.data.sort.indices),
                c || (c = new Uint32Array(f)),
                new Float32Array(i, d, 16).set(p),
                new Uint32Array(i, l, f).set(c),
                n.exports.sortIndexes(o, u, a, l, d, s, f, h));
              const m = new Int32Array(i, s, h);
              t.postMessage({ dataSorted: m });
            })(p));
      };
    }
    class ut extends f.Object3D {
      constructor(t = !1) {
        (super(),
          (this.material = null),
          (this.forceSorting = !0),
          (this.nodesAsString = ''),
          (this.lastSortViewDir = new f.Vector3(0, 0, -1)),
          (this.sortViewDir = new f.Vector3(0, 0, -1)),
          (this.lastSortViewPos = new f.Vector3()),
          (this.sortViewOffset = new f.Vector3()),
          (this.enableSorting = !0),
          (this.textures = new Array()),
          (this.enabled = !1),
          (this.texturesNeedUpdate = !1),
          (this.instanceCount = 0),
          (this.debugMode = !1),
          (this.rendererSize = new f.Vector2()),
          (this.harmonicsEnabled = !1),
          (this.debugMode = t));
      }
      initialize(t, e = !1) {
        return (
          (this.harmonicsEnabled = e),
          ((n = t),
          new Promise((t) => {
            const e = new Worker(
              URL.createObjectURL(
                new Blob(['(', lt.toString(), ')(self)'], { type: 'application/javascript' }),
              ),
            );
            (e.postMessage({ init: !0, splatCount: n }),
              (e.onmessage = (n) => {
                n.data.sorterReady && t(e);
              }));
          })).then((e) => {
            ((this.sorter = e), (this.indexesBuffer = new Int32Array(t)));
            let n = new Int32Array(t);
            for (let e = 0; e < t; e++) ((this.indexesBuffer[e] = e), (n[e] = e));
            const r = new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]),
              o = new Uint16Array([0, 1, 2, 2, 1, 3]);
            let s = new f.ShaderMaterial({
              glslVersion: f.GLSL3,
              vertexShader: i(391).A,
              fragmentShader: i(942).A,
              transparent: !0,
              depthTest: !0,
              depthWrite: !1,
              side: f.DoubleSide,
              uniforms: {
                focal: { value: new f.Vector2(0, 0) },
                inverseFocalAdjustment: { value: 1 },
                splatScale: { value: 1 },
                basisViewport: { value: new f.Vector2(0, 0) },
                covarianceTexture0: { value: null },
                covarianceTexture1: { value: null },
                posColorTexture: { value: null },
                nodeTexture: { value: null },
                nodeTexture2: { value: null },
                nodeIndicesTexture: { value: null },
                indicesTexture: { value: null },
                harmonicsTexture1: { value: null },
                harmonicsTexture2: { value: null },
                harmonicsTexture3: { value: null },
                visibleNodes: { value: null },
                cameraPosition: { value: new f.Vector3(0, 0, 0) },
                harmonicsDegree: { value: 3 },
                renderIds: { value: !1 },
                debugMode: { value: !1 },
                renderOnlyHarmonics: { value: !1 },
                adaptiveSize: { value: !1 },
                harmonicsScale: { value: 4 },
                octreeSize: { value: 0 },
                fov: { value: 1 },
                maxSplatScale: { value: 1.2 },
                screenHeight: { value: 1 },
                spacing: { value: 1 },
              },
            });
            this.material = s;
            let a = new f.InstancedBufferGeometry();
            (a.setAttribute('position', new f.BufferAttribute(r, 3)),
              a.setIndex(new f.BufferAttribute(o, 1)),
              a.setAttribute('indexes_sorted', new f.InstancedBufferAttribute(n, 1)),
              (this.mesh = new f.Mesh(a, s)),
              (this.mesh.frustumCulled = !1),
              this.add(this.mesh));
            let l = Math.ceil(Math.sqrt(t));
            ((this.bufferCenters = new Float32Array(l * l * 4)),
              (this.bufferPositions = new Float32Array(l * l * 4)),
              (this.bufferScale = new Float32Array(l * l * 3)),
              (this.bufferOrientation = new Float32Array(l * l * 4)),
              (this.bufferPosColor = new Uint32Array(l * l * 4)),
              (this.bufferCovariance0 = new Float32Array(l * l * 4)),
              (this.bufferCovariance1 = new Float32Array(l * l * 2)),
              (this.bufferNodes = new Float32Array(4e4)),
              (this.bufferNodes2 = new Uint32Array(2e4)),
              (this.bufferNodesIndices = new Uint32Array(l * l)),
              (this.bufferVisibilityNodes = new Uint8Array(8192)));
            let u = Math.ceil(Math.sqrt(3 * t)),
              d = Math.ceil(Math.sqrt(5 * t)),
              c = Math.ceil(Math.sqrt(7 * t));
            (this.debugMode && console.log('max texture size: ' + c + ' point budget: ' + t),
              (this.bufferHarmonics1 = new Uint32Array(u * u)),
              (this.bufferHarmonics2 = new Uint32Array(d * d)),
              (this.bufferHarmonics3 = new Uint32Array(c * c)),
              (this.textureNode = new f.DataTexture(
                this.bufferNodes,
                100,
                100,
                f.RGBAFormat,
                f.FloatType,
              )),
              (this.textureNode2 = new f.DataTexture(
                this.bufferNodes2,
                100,
                100,
                f.RGIntegerFormat,
                f.UnsignedIntType,
              )),
              (this.textureNode2.internalFormat = 'RG32UI'),
              (this.textureNodeIndices = new f.DataTexture(
                this.bufferNodesIndices,
                l,
                l,
                f.RedIntegerFormat,
                f.UnsignedIntType,
              )),
              (this.textureNodeIndices.internalFormat = 'R32UI'),
              (this.textureCovariance0 = new f.DataTexture(
                this.bufferCovariance0,
                l,
                l,
                f.RGBAFormat,
                f.FloatType,
              )),
              (this.textureCovariance1 = new f.DataTexture(
                this.bufferCovariance1,
                l,
                l,
                f.RGFormat,
                f.FloatType,
              )),
              (this.texturePosColor = new f.DataTexture(
                this.bufferPosColor,
                l,
                l,
                f.RGBAIntegerFormat,
                f.UnsignedIntType,
              )),
              (this.texturePosColor.internalFormat = 'RGBA32UI'),
              (this.textureHarmonics1 = new f.DataTexture(
                this.bufferHarmonics1,
                u,
                u,
                f.RedIntegerFormat,
                f.UnsignedIntType,
              )),
              (this.textureHarmonics1.internalFormat = 'R32UI'),
              (this.textureHarmonics2 = new f.DataTexture(
                this.bufferHarmonics2,
                d,
                d,
                f.RedIntegerFormat,
                f.UnsignedIntType,
              )),
              (this.textureHarmonics2.internalFormat = 'R32UI'),
              (this.textureHarmonics3 = new f.DataTexture(
                this.bufferHarmonics3,
                c,
                c,
                f.RedIntegerFormat,
                f.UnsignedIntType,
              )),
              (this.textureHarmonics3.internalFormat = 'R32UI'),
              (this.textureVisibilityNodes = new f.DataTexture(
                this.bufferVisibilityNodes,
                2048,
                1,
                f.RGBAFormat,
              )),
              (this.textureVisibilityNodes.magFilter = f.NearestFilter),
              this.textures.push(this.textureNode),
              this.textures.push(this.textureNodeIndices),
              this.textures.push(this.textureCovariance0),
              this.textures.push(this.textureCovariance1),
              this.textures.push(this.texturePosColor),
              this.textures.push(this.textureHarmonics1),
              this.textures.push(this.textureHarmonics2),
              this.textures.push(this.textureHarmonics3),
              this.textures.push(this.textureNode2),
              this.textures.push(this.textureVisibilityNodes),
              this.textures.map((t) => (t.needsUpdate = !0)),
              (this.material.uniforms.posColorTexture.value = this.texturePosColor),
              (this.material.uniforms.covarianceTexture0.value = this.textureCovariance0),
              (this.material.uniforms.covarianceTexture1.value = this.textureCovariance1),
              (this.material.uniforms.nodeTexture.value = this.textureNode),
              (this.material.uniforms.nodeTexture2.value = this.textureNode2),
              (this.material.uniforms.nodeIndicesTexture.value = this.textureNodeIndices),
              (this.material.uniforms.harmonicsTexture1.value = this.textureHarmonics1),
              (this.material.uniforms.harmonicsTexture2.value = this.textureHarmonics2),
              (this.material.uniforms.harmonicsTexture3.value = this.textureHarmonics3),
              (this.material.uniforms.visibleNodes.value = this.textureVisibilityNodes),
              (this.enabled = !0));
          })
        );
        var n;
      }
      renderSplatsIDs(t) {
        null != this.material &&
          ((this.material.uniforms.renderIds.value = t), (this.material.transparent = !t));
      }
      update(t, e, n, i = () => {}) {
        if (null == this.material) return;
        this.material.uniforms.cameraPosition.value = e.position;
        let r = t.material;
        ((r.visible = !1),
          (this.material.uniforms.octreeSize.value = r.uniforms.octreeSize.value),
          (this.material.uniforms.fov.value = r.uniforms.fov.value),
          (this.material.uniforms.spacing.value = r.uniforms.spacing.value),
          (this.material.uniforms.screenHeight.value = r.uniforms.screenHeight.value));
        let o = this.material;
        o.uniforms.basisViewport.value.set(1 / n.x, 1 / n.y);
        const s = 0.5 * e.projectionMatrix.elements[0] * n.x,
          a = 0.5 * e.projectionMatrix.elements[5] * n.y;
        o.uniforms.focal.value.set(s, a);
        let l = 0,
          u = 0,
          d = '',
          c = 0,
          h = 0;
        if (
          (t.traverse((t) => {
            let e = t.geometry;
            l += e.drawRange.count;
          }),
          (c = l * (this.harmonicsEnabled ? 236 : 56)),
          t.traverseVisible((t) => {
            d += t.name;
          }),
          (this.forceSorting = !1),
          this.bufferVisibilityNodes.set(r.uniforms.visibleNodes.value.image.data),
          d != this.nodesAsString && this.enableSorting)
        ) {
          ((this.nodesAsString = d), (l = 0), (u = 0));
          let n = 0;
          (t.traverseVisible((e) => {
            let i = e,
              r = i.geometry;
            const o = t.material.visibleNodeTextureOffsets.get(e.name),
              s = i.name.length - 1;
            n = Math.max(n, s);
            let a = [i.position.x, i.position.y, i.position.z, 1],
              d = [s, o];
            (this.bufferNodes.set(a, 4 * u),
              this.bufferNodes2.set(d, 2 * u),
              this.bufferNodesIndices.set(new Uint32Array(r.drawRange.count).fill(u), l),
              this.bufferCenters.set(r.getAttribute('raw_position').array, 4 * l),
              this.bufferPositions.set(r.getAttribute('centers').array, 4 * l),
              this.bufferScale.set(r.getAttribute('scale').array, 3 * l),
              this.bufferOrientation.set(r.getAttribute('orientation').array, 4 * l),
              this.bufferCovariance0.set(r.getAttribute('COVARIANCE0').array, 4 * l),
              this.bufferCovariance1.set(r.getAttribute('COVARIANCE1').array, 2 * l),
              this.bufferPosColor.set(r.getAttribute('POS_COLOR').array, 4 * l),
              this.harmonicsEnabled &&
                (this.bufferHarmonics1.set(r.getAttribute('HARMONICS1').array, 3 * l),
                this.bufferHarmonics2.set(r.getAttribute('HARMONICS2').array, 5 * l),
                this.bufferHarmonics3.set(r.getAttribute('HARMONICS3').array, 7 * l)),
              (l += r.drawRange.count),
              u++);
          }),
            (h = l * (this.harmonicsEnabled ? 236 : 56)),
            this.debugMode &&
              (console.log('----------------------------'),
              console.log('total memory in usage: ' + Math.ceil(c / 1e6) + ' MB'),
              console.log('total memory displayed: ' + Math.ceil(h / 1e6) + ' MB'),
              console.log('max level displayed: ' + n),
              console.log('----------------------------')),
            (this.instanceCount = l),
            (this.texturesNeedUpdate = !0),
            (this.forceSorting = !0),
            this.sortSplats(e, i));
        }
      }
      defer() {
        return new Promise((t) => {
          let e = 0,
            n = () => {
              let i = requestAnimationFrame(n);
              (1 == e && (t('true'), cancelAnimationFrame(i)), e++);
            };
          n();
        });
      }
      sortSplats(t, e = () => {}) {
        if (null == this.mesh || 0 == this.instanceCount) return;
        let n = new f.Matrix4();
        (t.updateMatrixWorld(),
          n.copy(t.matrixWorld).invert(),
          n.premultiply(t.projectionMatrix),
          n.multiply(this.mesh.matrixWorld));
        let i = 0,
          r = 0;
        if (
          (this.sortViewDir.set(0, 0, -1).applyQuaternion(t.quaternion),
          (i = this.sortViewDir.dot(this.lastSortViewDir)),
          (r = this.sortViewOffset.copy(t.position).sub(this.lastSortViewPos).length()),
          (this.forceSorting || i <= 0.99 || r >= 1) && this.enableSorting)
        ) {
          let i = {
            indices: this.indexesBuffer,
            centers: this.bufferCenters,
            modelViewProj: n.elements,
            totalSplats: this.instanceCount,
          };
          (this.sorter.postMessage({ sort: i }),
            (this.enableSorting = !1),
            (this.forceSorting = !1),
            (this.sorter.onmessage = async (t) => {
              if (t.data.dataSorted)
                if (null != t.data.dataSorted) {
                  let n = this.mesh.geometry.getAttribute('indexes_sorted');
                  (n.array.set(new Int32Array(t.data.dataSorted), 0),
                    (n.needsUpdate = !0),
                    this.texturesNeedUpdate &&
                      (this.textures.map((t) => (t.needsUpdate = !0)),
                      (this.texturesNeedUpdate = !1)),
                    (this.mesh.geometry.instanceCount = this.instanceCount),
                    this.defer().then((t) => {
                      (e(), (this.enableSorting = !0));
                    }));
                } else this.enableSorting = !0;
            }),
            this.lastSortViewPos.copy(t.position),
            this.lastSortViewDir.copy(this.sortViewDir));
        }
      }
      getSplatData(t, e) {
        if (null == this.mesh) return null;
        let n = new f.Vector3(),
          i = new f.Vector3(),
          r = new f.Vector3(),
          o = new f.Quaternion();
        return (
          (n.x = this.bufferPositions[4 * t + 0]),
          (n.y = this.bufferPositions[4 * t + 1]),
          (n.z = this.bufferPositions[4 * t + 2]),
          (r.x = this.bufferScale[3 * t + 0]),
          (r.y = this.bufferScale[3 * t + 1]),
          (r.z = this.bufferScale[3 * t + 2]),
          (o.w = this.bufferOrientation[4 * t + 0]),
          (o.x = this.bufferOrientation[4 * t + 1]),
          (o.y = this.bufferOrientation[4 * t + 2]),
          (o.z = this.bufferOrientation[4 * t + 3]),
          (i.x = this.bufferNodes[4 * e + 0]),
          (i.y = this.bufferNodes[4 * e + 1]),
          (i.z = this.bufferNodes[4 * e + 2]),
          n.add(i),
          { position: this.mesh.localToWorld(n), scale: r, orientation: o }
        );
      }
      dispose() {
        this.enabled &&
          (this.sorter.terminate(),
          (this.sorter = null),
          this.mesh.geometry.dispose(),
          this.material?.dispose(),
          this.textures.map((t) => t.dispose()),
          (this.textures = []),
          (this.indexesBuffer = null),
          (this.bufferCenters = null),
          (this.bufferPositions = null),
          (this.bufferScale = null),
          (this.bufferOrientation = null),
          (this.bufferPosColor = null),
          (this.bufferCovariance0 = null),
          (this.bufferCovariance1 = null),
          (this.bufferNodes = null),
          (this.bufferNodesIndices = null),
          (this.mesh = null),
          (this.enabled = !1));
      }
      get splatsEnabled() {
        return this.enabled;
      }
    }
    class dt extends at {
      constructor(t, e, n, i = !1) {
        (super(),
          (this.disposed = !1),
          (this.level = 0),
          (this.maxLevel = 1 / 0),
          (this.splatsMesh = new ut(!1)),
          (this.minNodePixelSize = 200),
          (this.root = null),
          (this.boundingBoxNodes = []),
          (this.visibleNodes = []),
          (this.visibleGeometry = []),
          (this.numVisiblePoints = 0),
          (this.showBoundingBox = !1),
          (this.visibleBounds = new f.Box3()),
          (this.renderAsSplats = null),
          (this.lastUpdateViewPos = new f.Vector3()),
          (this.updateViewOffset = new f.Vector3()),
          (this.loadHarmonics = !1),
          (this.name = ''),
          (this.potree = t),
          (this.root = e.root),
          (this.pcoGeometry = e),
          (this.boundingBox = e.boundingBox),
          (this.boundingSphere = this.boundingBox.getBoundingSphere(new f.Sphere())),
          (this.loadHarmonics = i),
          this.position.copy(e.offset),
          this.updateMatrix(),
          (this.material = n || e instanceof st ? new V({ colorRgba: !0 }) : new V()),
          this.initMaterial(this.material));
      }
      initMaterial(t) {
        this.updateMatrixWorld(!0);
        const { min: e, max: n } = J(
            this.pcoGeometry.tightBoundingBox || this.getBoundingBoxWorld(),
            this.matrixWorld,
          ),
          i = n.z - e.z;
        ((t.heightMin = e.z - 0.2 * i), (t.heightMax = n.z + 0.2 * i));
      }
      dispose() {
        (this.root && this.root.dispose(),
          this.pcoGeometry.root.traverse((t) => this.potree.lru.remove(t)),
          this.pcoGeometry.dispose(),
          this.material.dispose(),
          (this.visibleNodes = []),
          (this.visibleGeometry = []),
          this.picker && (this.picker.dispose(), (this.picker = void 0)),
          this.splatsMesh.dispose(),
          (this.disposed = !0));
      }
      get pointSizeType() {
        return this.material.pointSizeType;
      }
      set pointSizeType(t) {
        this.material.pointSizeType = t;
      }
      toTreeNode(t, e) {
        const n = new f.Points(t.geometry, this.material),
          i = new it(t, n);
        return (
          (n.name = t.name),
          n.position.copy(t.boundingBox.min),
          (n.frustumCulled = !1),
          (n.onBeforeRender = V.makeOnBeforeRender(this, i)),
          e
            ? (e.sceneNode.add(n),
              (e.children[t.index] = i),
              t.oneTimeDisposeHandlers.push(() => {
                (i.disposeSceneNode(), e.sceneNode.remove(i.sceneNode), (e.children[t.index] = t));
              }))
            : ((this.root = i), this.add(n)),
          i
        );
      }
      updateSplats(t, e, n = () => {}) {
        let i = this.children[0];
        i &&
          ((null !== this.renderAsSplats && this.renderAsSplats) ||
            ((this.renderAsSplats = !1),
            i.traverse((t) => {
              t.geometry.hasAttribute('COVARIANCE0') && (this.renderAsSplats = !0);
            }),
            this.renderAsSplats &&
              (this.splatsMesh.initialize(4e6, this.loadHarmonics), this.add(this.splatsMesh))),
          this.renderAsSplats && this.splatsMesh.splatsEnabled) &&
          (this.updateViewOffset.copy(t.position).sub(this.lastUpdateViewPos).length() < 0.01
            ? this.splatsMesh.update(i, t, e, n)
            : this.splatsMesh.splatsEnabled && this.splatsMesh.sortSplats(t, n),
          this.lastUpdateViewPos.copy(t.position));
      }
      updateVisibleBounds() {
        const t = this.visibleBounds;
        (t.min.set(1 / 0, 1 / 0, 1 / 0), t.max.set(-1 / 0, -1 / 0, -1 / 0));
        for (const e of this.visibleNodes)
          e.isLeafNode && (t.expandByPoint(e.boundingBox.min), t.expandByPoint(e.boundingBox.max));
      }
      updateBoundingBoxes() {
        if (!this.showBoundingBox || !this.parent) return;
        let t = this.parent.getObjectByName('bbroot');
        t || ((t = new f.Object3D()), (t.name = 'bbroot'), this.parent.add(t));
        const e = [];
        for (const t of this.visibleNodes)
          void 0 !== t.boundingBoxNode && t.isLeafNode && e.push(t.boundingBoxNode);
        t.children = e;
      }
      updateMatrixWorld(t) {
        (!0 === this.matrixAutoUpdate && this.updateMatrix(),
          (!0 !== this.matrixWorldNeedsUpdate && !0 !== t) ||
            (this.parent
              ? this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)
              : this.matrixWorld.copy(this.matrix),
            (this.matrixWorldNeedsUpdate = !1),
            (t = !0)));
      }
      hideDescendants(t) {
        const e = [];
        for (n(t); e.length > 0; ) {
          const t = e.shift();
          ((t.visible = !1), n(t));
        }
        function n(t) {
          for (const n of t.children) n.visible && e.push(n);
        }
      }
      moveToOrigin() {
        (this.position.set(0, 0, 0),
          this.position.set(0, 0, 0).sub(this.getBoundingBoxWorld().getCenter(new f.Vector3())));
      }
      moveToGroundPlane() {
        this.position.y += -this.getBoundingBoxWorld().min.y;
      }
      getBoundingBoxWorld() {
        return (this.updateMatrixWorld(!0), J(this.boundingBox, this.matrixWorld));
      }
      getVisibleExtent() {
        return this.visibleBounds.applyMatrix4(this.matrixWorld);
      }
      pick(t, e, n, i = {}) {
        return ((this.picker = this.picker || new ot()), this.picker.pick(t, e, n, [this], i));
      }
      get progress() {
        return 0 === this.visibleGeometry.length
          ? 0
          : this.visibleNodes.length / this.visibleGeometry.length;
      }
    }
    const ct = document.createElement('canvas').getContext('webgl'),
      ht = {
        SHADER_INTERPOLATION: ft('EXT_frag_depth') && pt(8),
        SHADER_SPLATS: ft('EXT_frag_depth') && ft('OES_texture_float') && pt(8),
        SHADER_EDL: ft('OES_texture_float') && pt(8),
        precision: (function () {
          if (null === ct) return '';
          const t = ct.getShaderPrecisionFormat(ct.VERTEX_SHADER, ct.HIGH_FLOAT),
            e = ct.getShaderPrecisionFormat(ct.VERTEX_SHADER, ct.MEDIUM_FLOAT),
            n = ct.getShaderPrecisionFormat(ct.FRAGMENT_SHADER, ct.HIGH_FLOAT),
            i = ct.getShaderPrecisionFormat(ct.FRAGMENT_SHADER, ct.MEDIUM_FLOAT),
            r = t && n && t.precision > 0 && n.precision > 0,
            o = e && i && e.precision > 0 && i.precision > 0;
          return r ? 'highp' : o ? 'mediump' : 'lowp';
        })(),
      };
    function ft(t) {
      return null !== ct && Boolean(ct.getExtension(t));
    }
    function pt(t) {
      return null !== ct && ct.getParameter(ct.MAX_VARYING_VECTORS) >= t;
    }
    class mt {
      constructor() {
        ((this.resolvers = []), (this.promises = []));
      }
      enqueue(t) {
        (this.resolvers.length || this.add(), this.resolvers.shift()(t));
      }
      dequeue() {
        return (this.promises.length || this.add(), this.promises.shift());
      }
      add() {
        this.promises.push(
          new Promise((t) => {
            this.resolvers.push(t);
          }),
        );
      }
    }
    class gt {
      constructor(t, e) {
        ((this.wrappedWorker = t),
          (this.maxIdle = e),
          (this.timeoutId = void 0),
          (this.terminated = !1));
      }
      get worker() {
        return this.wrappedWorker;
      }
      get isTerminated() {
        return this.terminated;
      }
      markIdle() {
        this.timeoutId = window.setTimeout(() => {
          ((this.terminated = !0), this.wrappedWorker.terminate());
        }, this.maxIdle);
      }
      markInUse() {
        this.timeoutId && window.clearTimeout(this.timeoutId);
      }
    }
    class At {
      constructor(t, e) {
        ((this.maxWorkers = t), (this.workerType = e), (this.pool = new mt()), (this.poolSize = 0));
      }
      getWorker() {
        return this.poolSize < this.maxWorkers
          ? (this.poolSize++, Promise.resolve(new gt(new this.workerType(), At.POOL_MAX_IDLE)))
          : this.pool
              .dequeue()
              .then(
                (t) => (t.markInUse(), t.isTerminated ? (this.poolSize--, this.getWorker()) : t),
              );
      }
      releaseWorker(t) {
        (t.markIdle(), this.pool.enqueue(t));
      }
    }
    At.POOL_MAX_IDLE = 7e3;
    class vt {
      constructor(t) {
        ((this.versionMinor = 0), (this.version = t));
        const e = -1 === t.indexOf('.') ? t.length : t.indexOf('.');
        ((this.versionMajor = parseInt(t.substr(0, e), 10)),
          (this.versionMinor = parseInt(t.substr(e + 1), 10)),
          isNaN(this.versionMinor) && (this.versionMinor = 0));
      }
      newerThan(t) {
        const e = new vt(t);
        return (
          this.versionMajor > e.versionMajor ||
          (this.versionMajor === e.versionMajor && this.versionMinor > e.versionMinor)
        );
      }
      equalOrHigher(t) {
        const e = new vt(t);
        return (
          this.versionMajor > e.versionMajor ||
          (this.versionMajor === e.versionMajor && this.versionMinor >= e.versionMinor)
        );
      }
      upTo(t) {
        return !this.newerThan(t);
      }
    }
    class yt {
      constructor({
        getUrl: t = (t) => Promise.resolve(t),
        version: e,
        boundingBox: n,
        scale: i,
        xhrRequest: r,
      }) {
        ((this.disposed = !1),
          (this.version = 'string' == typeof e ? new vt(e) : e),
          (this.xhrRequest = r),
          (this.getUrl = t),
          (this.boundingBox = n),
          (this.scale = i),
          (this.callbacks = []));
      }
      dispose() {
        this.disposed = !0;
      }
      load(t) {
        return t.loaded || this.disposed
          ? Promise.resolve()
          : Promise.resolve(this.getUrl(this.getNodeUrl(t)))
              .then((t) => this.xhrRequest(t, { mode: 'cors' }))
              .then((t) => _(t))
              .then((t) => t.arrayBuffer())
              .then((t) => b(t))
              .then((e) => new Promise((n) => this.parse(t, e, n)));
      }
      getNodeUrl(t) {
        let e = t.getUrl();
        return (this.version.equalOrHigher('1.4') && (e += '.bin'), e);
      }
      parse(t, e, n) {
        this.disposed
          ? n()
          : yt.WORKER_POOL.getWorker().then((i) => {
              const r = t.pcoGeometry.pointAttributes,
                o = e.byteLength / r.byteSize;
              (this.version.upTo('1.5') && (t.numPoints = o),
                (i.worker.onmessage = (e) => {
                  if (this.disposed) return (n(), void yt.WORKER_POOL.releaseWorker(i));
                  const r = e.data,
                    s = (t.geometry = t.geometry || new f.BufferGeometry());
                  ((s.boundingBox = t.boundingBox),
                    this.addBufferAttributes(s, r.attributeBuffers),
                    this.addIndices(s, r.indices),
                    this.addNormalAttribute(s, o),
                    (t.mean = new f.Vector3().fromArray(r.mean)),
                    (t.tightBoundingBox = this.getTightBoundingBox(r.tightBoundingBox)),
                    (t.loaded = !0),
                    (t.loading = !1),
                    (t.failed = !1),
                    t.pcoGeometry.numNodesLoading--,
                    (t.pcoGeometry.needsUpdate = !0),
                    this.callbacks.forEach((e) => e(t)),
                    n(),
                    yt.WORKER_POOL.releaseWorker(i));
                }));
              const s = {
                buffer: e,
                pointAttributes: r,
                version: this.version.version,
                min: t.boundingBox.min.toArray(),
                offset: t.pcoGeometry.offset.toArray(),
                scale: this.scale,
                spacing: t.spacing,
                hasChildren: t.hasChildren,
              };
              i.worker.postMessage(s, [s.buffer]);
            });
      }
      getTightBoundingBox({ min: t, max: e }) {
        const n = new f.Box3(new f.Vector3().fromArray(t), new f.Vector3().fromArray(e));
        return (n.max.sub(n.min), n.min.set(0, 0, 0), n);
      }
      addBufferAttributes(t, e) {
        Object.keys(e).forEach((n) => {
          const i = e[n].buffer;
          this.isAttribute(n, W.POSITION_CARTESIAN)
            ? t.setAttribute('position', new f.BufferAttribute(new Float32Array(i), 3))
            : this.isAttribute(n, W.COLOR_PACKED)
              ? t.setAttribute('color', new f.BufferAttribute(new Uint8Array(i), 3, !0))
              : this.isAttribute(n, W.INTENSITY)
                ? t.setAttribute('intensity', new f.BufferAttribute(new Float32Array(i), 1))
                : this.isAttribute(n, W.CLASSIFICATION)
                  ? t.setAttribute('classification', new f.BufferAttribute(new Uint8Array(i), 1))
                  : (this.isAttribute(n, W.NORMAL_SPHEREMAPPED) ||
                      this.isAttribute(n, W.NORMAL_OCT16) ||
                      this.isAttribute(n, W.NORMAL)) &&
                    t.setAttribute('normal', new f.BufferAttribute(new Float32Array(i), 3));
        });
      }
      addIndices(t, e) {
        const n = new f.Uint8BufferAttribute(e, 4);
        ((n.normalized = !0), t.setAttribute('indices', n));
      }
      addNormalAttribute(t, e) {
        if (!t.getAttribute('normal')) {
          const n = new Float32Array(3 * e);
          t.setAttribute('normal', new f.BufferAttribute(new Float32Array(n), 3));
        }
      }
      isAttribute(t, e) {
        return parseInt(t, 10) === e;
      }
    }
    function _t(t, e, n) {
      return Promise.resolve(e(t)).then((t) =>
        n(t, { mode: 'cors' })
          .then((t) => _(t))
          .then((t) => t.json())
          .then(
            (function (t, e, n) {
              return (i) => {
                const {
                    offset: r,
                    boundingBox: o,
                    tightBoundingBox: s,
                  } = (function (t) {
                    const e = new f.Vector3(t.boundingBox.lx, t.boundingBox.ly, t.boundingBox.lz),
                      n = new f.Vector3(t.boundingBox.ux, t.boundingBox.uy, t.boundingBox.uz),
                      i = new f.Box3(e, n),
                      r = i.clone(),
                      o = e.clone();
                    if (t.tightBoundingBox) {
                      const { lx: e, ly: n, lz: i, ux: o, uy: s, uz: a } = t.tightBoundingBox;
                      (r.min.set(e, n, i), r.max.set(o, s, a));
                    }
                    return (
                      i.min.sub(o),
                      i.max.sub(o),
                      r.min.sub(o),
                      r.max.sub(o),
                      { offset: o, boundingBox: i, tightBoundingBox: r }
                    );
                  })(i),
                  a = new yt({
                    getUrl: e,
                    version: i.version,
                    boundingBox: o,
                    scale: i.scale,
                    xhrRequest: n,
                  }),
                  l = new nt(a, o, s, r, n);
                ((l.url = t),
                  (l.octreeDir = i.octreeDir),
                  (l.needsUpdate = !0),
                  (l.spacing = i.spacing),
                  (l.hierarchyStepSize = i.hierarchyStepSize),
                  (l.projection = i.projection),
                  (l.offset = r),
                  (l.pointAttributes = new Q(i.pointAttributes)));
                const u = {},
                  d = new vt(i.version);
                return (function (t, e, n, i) {
                  const r = new et('r', t, t.boundingBox);
                  return (
                    (r.hasChildren = !0),
                    (r.spacing = t.spacing),
                    i.upTo('1.5') ? (r.numPoints = e.hierarchy[0][1]) : (r.numPoints = 0),
                    (t.root = r),
                    (n.r = r),
                    t.root.load()
                  );
                })(l, i, u, d).then(
                  () => (
                    d.upTo('1.4') &&
                      (function (t, e, n) {
                        for (let i = 1; i < e.hierarchy.length; i++) {
                          const [r, o] = e.hierarchy[i],
                            { index: s, parentName: a, level: l } = bt(r),
                            u = n[a],
                            d = tt(u.boundingBox, s),
                            c = new et(r, t, d);
                          ((c.level = l),
                            (c.numPoints = o),
                            (c.spacing = t.spacing / Math.pow(2, c.level)),
                            (n[r] = c),
                            u.addChild(c));
                        }
                      })(l, i, u),
                    (l.nodes = u),
                    l
                  ),
                );
              };
            })(t, e, n),
          ),
      );
    }
    function bt(t) {
      return { index: v(t), parentName: t.substring(0, t.length - 1), level: t.length - 1 };
    }
    var xt;
    ((yt.WORKER_POOL = new At(32, i(57).A)),
      (function (t) {
        ((t.DECODER_WORKER = 'DECODER_WORKER'),
          (t.DECODER_WORKER_GLTF = 'DECODER_WORKER_GLTF'),
          (t.DECODER_WORKER_SPLATS = 'DECODER_WORKER_SPLATS'));
      })(xt || (xt = {})));
    class Tt {
      constructor() {
        this.workers = { DECODER_WORKER: [], DECODER_WORKER_GLTF: [], DECODER_WORKER_SPLATS: [] };
      }
      getWorker(t) {
        if (void 0 === this.workers[t]) throw new Error('Unknown worker type');
        if (0 === this.workers[t].length) {
          const e = (function (t) {
            switch (t) {
              case xt.DECODER_WORKER:
                return new (0, i(30).A)();
              case xt.DECODER_WORKER_GLTF:
                return new (0, i(504).A)();
              case xt.DECODER_WORKER_SPLATS:
                return new (0, i(950).A)();
              default:
                throw new Error('Unknown worker type');
            }
          })(t);
          this.workers[t].push(e);
        }
        const e = this.workers[t].pop();
        if (void 0 === e) throw new Error('No workers available');
        return e;
      }
      returnWorker(t, e) {
        this.workers[t].push(e);
      }
    }
    class wt {
      constructor(t, e) {
        ((this.metadata = t),
          (this.context = e),
          (this.workerType = xt.DECODER_WORKER),
          (this._metadata = t));
      }
      async decode(t, e) {
        const { byteOffset: n, byteSize: i } = t;
        if (void 0 === n || void 0 === i) throw new Error('byteOffset and byteSize are required');
        let r;
        const o = await this.getUrl(this.octreePath),
          s = n,
          a = n + i - BigInt(1);
        if (i === BigInt(0))
          ((r = new ArrayBuffer(0)), console.warn(`loaded node with 0 bytes: ${t.name}`));
        else {
          const t = { Range: `bytes=${s}-${a}` },
            e = await fetch(o, { headers: t });
          r = await e.arrayBuffer();
        }
        const l = t.octreeGeometry.pointAttributes,
          u = t.octreeGeometry.scale,
          d = t.boundingBox,
          c = t.octreeGeometry.offset.clone().add(d.min),
          h = d.max.clone().sub(d.min),
          f = c.clone().add(h),
          p = t.numPoints,
          m = this._metadata.offset,
          g = {
            name: t.name,
            buffer: r,
            pointAttributes: l,
            scale: u,
            min: c,
            max: f,
            size: h,
            offset: m,
            numPoints: p,
          };
        e.postMessage(g, [g.buffer]);
        const A = await new Promise((t) => {
          e.onmessage = t;
        });
        return this.readSuccessMessage(A, r);
      }
      get getUrl() {
        return this.context.getUrl;
      }
      get octreePath() {
        return this.context.octreePath;
      }
      readSuccessMessage(t, e) {
        const n = t.data,
          i = n.attributeBuffers,
          r = new f.BufferGeometry();
        for (const t in i) {
          const e = i[t].buffer;
          if ('position' === t)
            r.setAttribute('position', new f.BufferAttribute(new Float32Array(e), 3));
          else if ('rgba' === t)
            r.setAttribute('rgba', new f.BufferAttribute(new Uint8Array(e), 4, !0));
          else if ('NORMAL' === t)
            r.setAttribute('normal', new f.BufferAttribute(new Float32Array(e), 3));
          else if ('INDICES' === t) {
            const t = new f.BufferAttribute(new Uint8Array(e), 4);
            ((t.normalized = !0), r.setAttribute('indices', t));
          } else {
            const n = new f.BufferAttribute(new Float32Array(e), 1),
              o = i[t].attribute;
            ((n.potree = {
              offset: i[t].offset,
              scale: i[t].scale,
              preciseBuffer: i[t].preciseBuffer,
              range: o.range,
            }),
              r.setAttribute(t, n));
          }
        }
        return { data: n, buffer: e, geometry: r };
      }
    }
    function It(t, e) {
      return `${t}${e}`;
    }
    function Nt(t, e) {
      var n = new Uint8Array(t.byteLength + e.byteLength);
      return (n.set(new Uint8Array(t), 0), n.set(new Uint8Array(e), t.byteLength), n.buffer);
    }
    class St {
      constructor(t, e) {
        ((this.metadata = t),
          (this.context = e),
          (this.workerType = xt.DECODER_WORKER_GLTF),
          (this._metadata = t));
      }
      async decode(t, e) {
        const { byteOffset: n, byteSize: i } = t;
        if (void 0 === n || void 0 === i) throw new Error('byteOffset and byteSize are required');
        let r;
        const o = await this.getUrl(this.gltfColorsPath),
          s = await this.getUrl(this.gltfPositionsPath);
        if (i === BigInt(0))
          ((r = new ArrayBuffer(0)), console.warn(`loaded node with 0 bytes: ${t.name}`));
        else {
          const t = { Range: `bytes=${4n * n * 3n}-${4n * n * 3n + 4n * i * 3n - 1n}` },
            e = await fetch(s, { headers: t }),
            a = await e.arrayBuffer(),
            l = { Range: `bytes=${4n * n}-${4n * n + 4n * i - 1n}` },
            u = await fetch(o, { headers: l });
          r = Nt(a, await u.arrayBuffer());
        }
        const a = t.octreeGeometry.pointAttributes,
          l = t.octreeGeometry.scale,
          u = t.boundingBox,
          d = t.octreeGeometry.offset.clone().add(u.min),
          c = u.max.clone().sub(u.min),
          h = d.clone().add(c),
          p = t.numPoints,
          m = this._metadata.offset,
          g = {
            name: t.name,
            buffer: r,
            pointAttributes: a,
            scale: l,
            min: d,
            max: h,
            size: c,
            offset: m,
            numPoints: p,
          };
        e.postMessage(g, [g.buffer]);
        const A = (await new Promise((t) => (e.onmessage = t))).data,
          v = A.attributeBuffers,
          y = new f.BufferGeometry();
        for (const t in v) {
          const e = v[t].buffer;
          if ('position' === t)
            y.setAttribute('position', new f.BufferAttribute(new Float32Array(e), 3));
          else if ('rgba' === t)
            y.setAttribute('rgba', new f.BufferAttribute(new Uint8Array(e), 4, !0));
          else if ('NORMAL' === t)
            y.setAttribute('normal', new f.BufferAttribute(new Float32Array(e), 3));
          else if ('INDICES' === t) {
            const t = new f.BufferAttribute(new Uint8Array(e), 4);
            ((t.normalized = !0), y.setAttribute('indices', t));
          } else {
            const n = new f.BufferAttribute(new Float32Array(e), 1),
              i = v[t].attribute;
            ((n.potree = {
              offset: v[t].offset,
              scale: v[t].scale,
              preciseBuffer: v[t].preciseBuffer,
              range: i.range,
            }),
              y.setAttribute(t, n));
          }
        }
        return { buffer: r, geometry: y, data: A };
      }
      get gltfColorsPath() {
        return this.context.gltfColorsPath;
      }
      get gltfPositionsPath() {
        return this.context.gltfPositionsPath;
      }
      get getUrl() {
        return this.context.getUrl;
      }
    }
    class Ct {
      constructor(t, e) {
        ((this.metadata = t),
          (this.context = e),
          (this.workerType = xt.DECODER_WORKER_SPLATS),
          (this._metadata = t));
      }
      async decode(t, e) {
        const { byteOffset: n, byteSize: i } = t;
        if (void 0 === n || void 0 === i) throw new Error('byteOffset and byteSize are required');
        let r,
          o,
          s = this.metadata,
          a = function (t) {
            return s.attributes.filter((e) => e.name === t)[0].bufferView.uri;
          };
        ((r = {
          positions: await this.getUrl(a('position')),
          colors: await this.getUrl(a('sh_band_0')),
          opacities: await this.getUrl(a('opacity')),
          scales: await this.getUrl(a('scale')),
          rotations: await this.getUrl(a('rotation')),
        }),
          this.harmonicsEnabled &&
            (r = {
              positions: await this.getUrl(a('position')),
              colors: await this.getUrl(a('sh_band_0')),
              opacities: await this.getUrl(a('opacity')),
              scales: await this.getUrl(a('scale')),
              rotations: await this.getUrl(a('rotation')),
              shBand1_0: await this.getUrl(a('sh_band_1_triplet_0')),
              shBand1_1: await this.getUrl(a('sh_band_1_triplet_1')),
              shBand1_2: await this.getUrl(a('sh_band_1_triplet_2')),
              shBand2_0: await this.getUrl(a('sh_band_2_triplet_0')),
              shBand2_1: await this.getUrl(a('sh_band_2_triplet_1')),
              shBand2_2: await this.getUrl(a('sh_band_2_triplet_2')),
              shBand2_3: await this.getUrl(a('sh_band_2_triplet_3')),
              shBand2_4: await this.getUrl(a('sh_band_2_triplet_4')),
              shBand3_0: await this.getUrl(a('sh_band_3_triplet_0')),
              shBand3_1: await this.getUrl(a('sh_band_3_triplet_1')),
              shBand3_2: await this.getUrl(a('sh_band_3_triplet_2')),
              shBand3_3: await this.getUrl(a('sh_band_3_triplet_3')),
              shBand3_4: await this.getUrl(a('sh_band_3_triplet_4')),
              shBand3_5: await this.getUrl(a('sh_band_3_triplet_5')),
              shBand3_6: await this.getUrl(a('sh_band_3_triplet_6')),
            }));
        const l = {
          positions: 3n,
          colors: 3n,
          opacities: 1n,
          scales: 3n,
          rotations: 4n,
          shBand1_0: 3n,
          shBand1_1: 3n,
          shBand1_2: 3n,
          shBand2_0: 3n,
          shBand2_1: 3n,
          shBand2_2: 3n,
          shBand2_3: 3n,
          shBand2_4: 3n,
          shBand3_0: 3n,
          shBand3_1: 3n,
          shBand3_2: 3n,
          shBand3_3: 3n,
          shBand3_4: 3n,
          shBand3_5: 3n,
          shBand3_6: 3n,
        };
        if (i === BigInt(0)) return void console.warn(`Loaded node with 0 bytes: ${t.name}`);
        {
          const t = async (t, e) => {
              const r = 4n * n * e,
                o = { Range: `bytes=${r}-${r + 4n * i * e - 1n}` };
              return (await fetch(t, { headers: o })).arrayBuffer();
            },
            e = Object.entries(r).map(([e, n]) => t(n, l[e])),
            [s, a, u, d, c, h, f, p, m, g, A, v, y, _, b, x, T, w, I, N] = await Promise.all(e);
          ((o = Nt(s, a)),
            (o = Nt(o, u)),
            (o = Nt(o, d)),
            (o = Nt(o, c)),
            this.harmonicsEnabled &&
              ((o = Nt(o, h)),
              (o = Nt(o, f)),
              (o = Nt(o, p)),
              (o = Nt(o, m)),
              (o = Nt(o, g)),
              (o = Nt(o, A)),
              (o = Nt(o, v)),
              (o = Nt(o, y)),
              (o = Nt(o, _)),
              (o = Nt(o, b)),
              (o = Nt(o, x)),
              (o = Nt(o, T)),
              (o = Nt(o, w)),
              (o = Nt(o, I)),
              (o = Nt(o, N))));
        }
        const u = t.octreeGeometry.pointAttributes,
          d = t.octreeGeometry.scale,
          c = t.boundingBox,
          h = t.octreeGeometry.offset.clone().add(c.min),
          p = c.max.clone().sub(c.min),
          m = h.clone().add(p),
          g = t.numPoints,
          A = this._metadata.offset,
          v = {
            name: t.name,
            buffer: o,
            pointAttributes: u,
            scale: d,
            min: h,
            max: m,
            size: p,
            offset: A,
            numPoints: g,
            harmonicsEnabled: this.harmonicsEnabled,
          };
        e.postMessage(v, [v.buffer]);
        const y = (await new Promise((t) => (e.onmessage = t))).data,
          _ = y.attributeBuffers,
          b = new f.BufferGeometry();
        b.drawRange.count = t.numPoints;
        for (const t in _) {
          const e = _[t].buffer;
          ('position' === t &&
            b.setAttribute('centers', new f.BufferAttribute(new Float32Array(e), 4)),
            'scale' === t && b.setAttribute('scale', new f.BufferAttribute(new Float32Array(e), 3)),
            'orientation' === t &&
              b.setAttribute('orientation', new f.BufferAttribute(new Float32Array(e), 4)),
            'raw_position' === t
              ? b.setAttribute('raw_position', new f.BufferAttribute(new Float32Array(e), 4))
              : 'COVARIANCE0' === t
                ? b.setAttribute('COVARIANCE0', new f.BufferAttribute(new Float32Array(e), 4))
                : 'COVARIANCE1' === t
                  ? b.setAttribute('COVARIANCE1', new f.BufferAttribute(new Float32Array(e), 2))
                  : 'POS_COLOR' === t &&
                    b.setAttribute('POS_COLOR', new f.BufferAttribute(new Uint32Array(e), 4)),
            this.harmonicsEnabled &&
              ('HARMONICS1' === t
                ? b.setAttribute('HARMONICS1', new f.BufferAttribute(new Uint32Array(e), 3))
                : 'HARMONICS2' === t
                  ? b.setAttribute('HARMONICS2', new f.BufferAttribute(new Uint32Array(e), 5))
                  : 'HARMONICS3' === t &&
                    b.setAttribute('HARMONICS3', new f.BufferAttribute(new Uint32Array(e), 7))));
        }
        return { data: y, buffer: o, geometry: b };
      }
      get getUrl() {
        return this.context.getUrl;
      }
      get harmonicsEnabled() {
        return this.context.harmonicsEnabled;
      }
    }
    class Et {
      constructor(t, e, n) {
        ((this.name = t),
          (this.octreeGeometry = e),
          (this.boundingBox = n),
          (this.loaded = !1),
          (this.loading = !1),
          (this.failed = !1),
          (this.parent = null),
          (this.hasChildren = !1),
          (this.isLeafNode = !0),
          (this.isTreeNode = !1),
          (this.isGeometryNode = !0),
          (this.children = [null, null, null, null, null, null, null, null]),
          (this.id = Et.IDCount++),
          (this.index = parseInt(t.charAt(t.length - 1))),
          (this.boundingSphere = n.getBoundingSphere(new f.Sphere())),
          (this.tightBoundingBox = n.clone()),
          (this.numPoints = 0),
          (this.oneTimeDisposeHandlers = []));
      }
      getLevel() {
        return this.level;
      }
      isLoaded() {
        return this.loaded;
      }
      getBoundingSphere() {
        return this.boundingSphere;
      }
      getBoundingBox() {
        return this.boundingBox;
      }
      load() {
        return this.octreeGeometry.numNodesLoading >= this.octreeGeometry.maxNumNodesLoading
          ? Promise.resolve()
          : this.octreeGeometry.loader
            ? this.octreeGeometry.loader.load(this)
            : ((this.loading = !1),
              (this.failed = !0),
              Promise.reject(`Loader not initialized for ${this.name}`));
      }
      getNumPoints() {
        return this.numPoints;
      }
      dispose() {
        if (this.geometry && null != this.parent) {
          (this.geometry.dispose(), (this.geometry = void 0), (this.loaded = !1));
          for (let t = 0; t < this.oneTimeDisposeHandlers.length; t++)
            (0, this.oneTimeDisposeHandlers[t])();
          this.oneTimeDisposeHandlers = [];
        }
      }
      traverse(t, e = !0) {
        const n = e ? [this] : [];
        let i;
        for (; void 0 !== (i = n.pop()); ) {
          t(i);
          for (const t of i.children) null !== t && n.push(t);
        }
      }
    }
    ((Et.IDCount = 0), (Et.IDCount = 0));
    const Pt = {
      DATA_TYPE_DOUBLE: { ordinal: 0, name: 'double', size: 8 },
      DATA_TYPE_FLOAT: { ordinal: 1, name: 'float', size: 4 },
      DATA_TYPE_INT8: { ordinal: 2, name: 'int8', size: 1 },
      DATA_TYPE_UINT8: { ordinal: 3, name: 'uint8', size: 1 },
      DATA_TYPE_INT16: { ordinal: 4, name: 'int16', size: 2 },
      DATA_TYPE_UINT16: { ordinal: 5, name: 'uint16', size: 2 },
      DATA_TYPE_INT32: { ordinal: 6, name: 'int32', size: 4 },
      DATA_TYPE_UINT32: { ordinal: 7, name: 'uint32', size: 4 },
      DATA_TYPE_INT64: { ordinal: 8, name: 'int64', size: 8 },
      DATA_TYPE_UINT64: { ordinal: 9, name: 'uint64', size: 8 },
    };
    let Ot = 0;
    for (const t in Pt) ((Pt[Ot] = Pt[t]), Ot++);
    class Dt {
      constructor(t, e, n, i = [1 / 0, -1 / 0], r = void 0) {
        ((this.name = t),
          (this.type = e),
          (this.numElements = n),
          (this.range = i),
          (this.uri = r),
          (this.byteSize = this.numElements * this.type.size),
          (this.description = ''));
      }
    }
    const Mt = {
      POSITION_CARTESIAN: new Dt('POSITION_CARTESIAN', Pt.DATA_TYPE_FLOAT, 3),
      RGBA_PACKED: new Dt('COLOR_PACKED', Pt.DATA_TYPE_INT8, 4),
      COLOR_PACKED: new Dt('COLOR_PACKED', Pt.DATA_TYPE_INT8, 4),
      RGB_PACKED: new Dt('COLOR_PACKED', Pt.DATA_TYPE_INT8, 3),
      NORMAL_FLOATS: new Dt('NORMAL_FLOATS', Pt.DATA_TYPE_FLOAT, 3),
      INTENSITY: new Dt('INTENSITY', Pt.DATA_TYPE_UINT16, 1),
      CLASSIFICATION: new Dt('CLASSIFICATION', Pt.DATA_TYPE_UINT8, 1),
      NORMAL_SPHEREMAPPED: new Dt('NORMAL_SPHEREMAPPED', Pt.DATA_TYPE_UINT8, 2),
      NORMAL_OCT16: new Dt('NORMAL_OCT16', Pt.DATA_TYPE_UINT8, 2),
      NORMAL: new Dt('NORMAL', Pt.DATA_TYPE_FLOAT, 3),
      RETURN_NUMBER: new Dt('RETURN_NUMBER', Pt.DATA_TYPE_UINT8, 1),
      NUMBER_OF_RETURNS: new Dt('NUMBER_OF_RETURNS', Pt.DATA_TYPE_UINT8, 1),
      SOURCE_ID: new Dt('SOURCE_ID', Pt.DATA_TYPE_UINT16, 1),
      INDICES: new Dt('INDICES', Pt.DATA_TYPE_UINT32, 1),
      SPACING: new Dt('SPACING', Pt.DATA_TYPE_FLOAT, 1),
      GPS_TIME: new Dt('GPS_TIME', Pt.DATA_TYPE_DOUBLE, 1),
    };
    class Bt {
      constructor(t, e = [], n = 0, i = 0, r = []) {
        if (
          ((this.attributes = e),
          (this.byteSize = n),
          (this.size = i),
          (this.vectors = r),
          null != t)
        )
          for (let e = 0; e < t.length; e++) {
            const n = t[e],
              i = Mt[n];
            (this.attributes.push(i), (this.byteSize += i.byteSize), this.size++);
          }
      }
      add(t) {
        (this.attributes.push(t), (this.byteSize += t.byteSize), this.size++);
      }
      addVector(t) {
        this.vectors.push(t);
      }
      hasNormals() {
        for (const t in this.attributes) {
          const e = this.attributes[t];
          if (
            e === Mt.NORMAL_SPHEREMAPPED ||
            e === Mt.NORMAL_FLOATS ||
            e === Mt.NORMAL ||
            e === Mt.NORMAL_OCT16
          )
            return !0;
        }
        return !1;
      }
      getAttribute(t) {
        return this.attributes.find((e) => e.name === t);
      }
    }
    class Rt {
      constructor(t, e, n) {
        ((this.url = t),
          (this.metadata = e),
          (this.loadingContext = n),
          'GLTF' !== this.metadata.encoding
            ? (this.decoder = new wt(e, n))
            : e.attributes.some((t) => 'sh_band_0' === t.name)
              ? (this.decoder = new Ct(e, n))
              : (this.decoder = new St(e, n)));
      }
      async load(t) {
        if (t.loaded || t.loading) return;
        let e;
        ((t.loading = !0), t.octreeGeometry.numNodesLoading++);
        try {
          2 === t.nodeType && (await this.loadHierarchy(t));
          const { byteOffset: n, byteSize: i } = t;
          if (void 0 === n || void 0 === i) throw new Error('byteOffset and byteSize are required');
          e = this.workerPool.getWorker(this.workerType);
          const r = await this.decoder.decode(t, e);
          if (!r) return;
          const { geometry: o, data: s } = r;
          ((t.density = s.density),
            (t.geometry = o),
            (t.loaded = !0),
            (t.octreeGeometry.needsUpdate = !0),
            (t.tightBoundingBox = this.getTightBoundingBox(s.tightBoundingBox)));
        } catch (e) {
          t.loaded = !1;
        } finally {
          ((t.loading = !1),
            t.octreeGeometry.numNodesLoading--,
            e && this.workerPool.returnWorker(this.workerType, e));
        }
      }
      get workerPool() {
        return this.loadingContext.workerPool;
      }
      get getUrl() {
        return this.loadingContext.getUrl;
      }
      get hierarchyPath() {
        return this.loadingContext.hierarchyPath;
      }
      get workerType() {
        return this.decoder.workerType;
      }
      parseHierarchy(t, e) {
        const n = new DataView(e),
          i = 22,
          r = e.byteLength / i,
          o = t.octreeGeometry,
          s = new Array(r);
        s[0] = t;
        let a = 1;
        for (let t = 0; t < r; t++) {
          const e = s[t],
            r = n.getUint8(t * i + 0),
            l = n.getUint8(t * i + 1),
            u = n.getUint32(t * i + 2, !0),
            d = n.getBigInt64(t * i + 6, !0),
            c = n.getBigInt64(t * i + 14, !0);
          if (
            (2 === e.nodeType
              ? ((e.byteOffset = d), (e.byteSize = c), (e.numPoints = u))
              : 2 === r
                ? ((e.hierarchyByteOffset = d), (e.hierarchyByteSize = c), (e.numPoints = u))
                : ((e.byteOffset = d), (e.byteSize = c), (e.numPoints = u)),
            (e.nodeType = r),
            2 !== e.nodeType)
          )
            for (let t = 0; t < 8; t++) {
              if (!((1 << t) & l)) continue;
              const n = e.name + t,
                i = zt(e.boundingBox, t),
                r = new Et(n, o, i);
              ((r.name = n),
                (r.spacing = e.spacing / 2),
                (r.level = e.level + 1),
                (e.children[t] = r),
                (r.parent = e),
                (s[a] = r),
                a++);
            }
        }
      }
      async loadHierarchy(t) {
        const { hierarchyByteOffset: e, hierarchyByteSize: n } = t;
        if (void 0 === e || void 0 === n)
          throw new Error(
            `hierarchyByteOffset and hierarchyByteSize are undefined for node ${t.name}`,
          );
        const i = await this.getUrl(this.hierarchyPath),
          r = { Range: `bytes=${e}-${e + n - BigInt(1)}` },
          o = await fetch(i, { headers: r }),
          s = await o.arrayBuffer();
        this.parseHierarchy(t, s);
      }
      getTightBoundingBox({ min: t, max: e }) {
        const n = new f.Box3(new f.Vector3().fromArray(t), new f.Vector3().fromArray(e));
        return (n.max.sub(n.min), n.min.set(0, 0, 0), n);
      }
    }
    const Lt = new f.Vector3();
    function zt(t, e) {
      const n = t.min.clone(),
        i = t.max.clone(),
        r = Lt.subVectors(i, n);
      return (
        (1 & e) > 0 ? (n.z += r.z / 2) : (i.z -= r.z / 2),
        (2 & e) > 0 ? (n.y += r.y / 2) : (i.y -= r.y / 2),
        (4 & e) > 0 ? (n.x += r.x / 2) : (i.x -= r.x / 2),
        new f.Box3(n, i)
      );
    }
    const Ft = {
      double: Pt.DATA_TYPE_DOUBLE,
      float: Pt.DATA_TYPE_FLOAT,
      int8: Pt.DATA_TYPE_INT8,
      uint8: Pt.DATA_TYPE_UINT8,
      int16: Pt.DATA_TYPE_INT16,
      uint16: Pt.DATA_TYPE_UINT16,
      int32: Pt.DATA_TYPE_INT32,
      uint32: Pt.DATA_TYPE_UINT32,
      int64: Pt.DATA_TYPE_INT64,
      uint64: Pt.DATA_TYPE_UINT64,
    };
    class Ut {
      constructor(t, e, n = !1) {
        ((this.workerPool = new Tt()),
          (this.basePath = ''),
          (this.hierarchyPath = ''),
          (this.octreePath = ''),
          (this.gltfColorsPath = ''),
          (this.gltfPositionsPath = ''),
          (this.harmonicsEnabled = !1),
          (this.getUrl = t),
          (this.basePath = (function (t) {
            return t.substring(0, t.lastIndexOf('/') + 1);
          })(e)),
          (this.hierarchyPath = It(this.basePath, 'hierarchy.bin')),
          (this.octreePath = It(this.basePath, 'octree.bin')),
          (this.harmonicsEnabled = n),
          (this.gltfColorsPath = It(this.basePath, 'colors.glbin')),
          (this.gltfPositionsPath = It(this.basePath, 'positions.glbin')));
      }
      static parseAttributes(t) {
        const e = new Bt(),
          n = { rgb: 'rgba' };
        for (const i of t) {
          const { name: t, numElements: r, min: o, max: s, bufferView: a } = i,
            l = Ft[i.type],
            u = new Dt(n[t] ? n[t] : t, l, r);
          (a && (u.uri = a.uri),
            (u.range = 1 === r && o && s ? [o[0], s[0]] : [o, s]),
            'gps-time' === t &&
              'number' == typeof u.range[0] &&
              u.range[0] === u.range[1] &&
              (u.range[1] += 1),
            (u.initialRange = u.range),
            e.add(u));
        }
        if (
          void 0 !== e.attributes.find((t) => 'NormalX' === t.name) &&
          void 0 !== e.attributes.find((t) => 'NormalY' === t.name) &&
          void 0 !== e.attributes.find((t) => 'NormalZ' === t.name)
        ) {
          const t = { name: 'NORMAL', attributes: ['NormalX', 'NormalY', 'NormalZ'] };
          e.addVector(t);
        }
        return e;
      }
      async load(t, e) {
        const n = await this.fetchMetadata(t, e),
          i = Ut.parseAttributes(n.attributes);
        this.applyCustomBufferURI(n.encoding, i);
        const r = this.createLoader(t, n),
          o = this.createBoundingBox(n),
          s = this.getOffset(o),
          a = this.initializeOctree(r, t, n, o, s, i),
          l = this.initializeRootNode(a, o, n);
        return ((a.root = l), r.load(l), { geometry: a });
      }
      async fetchMetadata(t, e) {
        return (await e(t)).json();
      }
      applyCustomBufferURI(t, e) {
        'GLTF' === t &&
          ((this.gltfPositionsPath = e.getAttribute('position')?.uri ?? this.gltfPositionsPath),
          (this.gltfColorsPath = e.getAttribute('rgba')?.uri ?? this.gltfColorsPath));
      }
      createLoader(t, e) {
        return new Rt(t, e, this);
      }
      createBoundingBox(t) {
        const e = new f.Vector3(...t.boundingBox.min),
          n = new f.Vector3(...t.boundingBox.max);
        return new f.Box3(e, n);
      }
      getOffset(t) {
        const e = t.min.clone();
        return (t.min.sub(e), t.max.sub(e), e);
      }
      initializeOctree(t, e, n, i, r, o) {
        const s = new st(t, i);
        return (
          (s.url = e),
          (s.spacing = n.spacing),
          (s.scale = n.scale),
          (s.projection = n.projection),
          (s.boundingBox = i),
          (s.boundingSphere = i.getBoundingSphere(new f.Sphere())),
          (s.tightBoundingSphere = i.getBoundingSphere(new f.Sphere())),
          (s.tightBoundingBox = this.getTightBoundingBox(n)),
          (s.offset = r),
          (s.pointAttributes = o),
          s
        );
      }
      initializeRootNode(t, e, n) {
        const i = new Et('r', t, e);
        return (
          (i.level = 0),
          (i.nodeType = 2),
          (i.hierarchyByteOffset = BigInt(0)),
          (i.hierarchyByteSize = BigInt(n.hierarchy.firstChunkSize)),
          (i.spacing = t.spacing),
          (i.byteOffset = BigInt(0)),
          i
        );
      }
      getTightBoundingBox(t) {
        const e = t.attributes.find((t) => 'position' === t.name);
        if (!e || !e.min || !e.max)
          return (
            console.warn(
              'Position attribute (min, max) not found. Falling back to boundingBox for tightBoundingBox',
            ),
            new f.Box3(new f.Vector3(...t.boundingBox.min), new f.Vector3(...t.boundingBox.max))
          );
        const n = t.boundingBox.min;
        return new f.Box3(
          new f.Vector3(e.min[0] - n[0], e.min[1] - n[1], e.min[2] - n[2]),
          new f.Vector3(e.max[0] - n[0], e.max[1] - n[1], e.max[2] - n[2]),
        );
      }
    }
    async function Vt(t, e, n, i = !1) {
      const r = await e(t),
        o = new Ut(e, t, i),
        { geometry: s } = await o.load(r, n);
      return s;
    }
    function Gt(t) {
      return null != t && t.isGeometryNode;
    }
    function Ht(t) {
      return null != t && t.isTreeNode;
    }
    function Yt(t) {
      ((this.content = []), (this.scoreFunction = t));
    }
    Yt.prototype = {
      push: function (t) {
        (this.content.push(t), this.bubbleUp(this.content.length - 1));
      },
      pop: function () {
        var t = this.content[0],
          e = this.content.pop();
        return (this.content.length > 0 && ((this.content[0] = e), this.sinkDown(0)), t);
      },
      remove: function (t) {
        for (var e = this.content.length, n = 0; n < e; n++)
          if (this.content[n] == t) {
            var i = this.content.pop();
            if (n == e - 1) break;
            ((this.content[n] = i), this.bubbleUp(n), this.sinkDown(n));
            break;
          }
      },
      size: function () {
        return this.content.length;
      },
      bubbleUp: function (t) {
        for (var e = this.content[t], n = this.scoreFunction(e); t > 0; ) {
          var i = Math.floor((t + 1) / 2) - 1,
            r = this.content[i];
          if (n >= this.scoreFunction(r)) break;
          ((this.content[i] = e), (this.content[t] = r), (t = i));
        }
      },
      sinkDown: function (t) {
        for (var e = this.content.length, n = this.content[t], i = this.scoreFunction(n); ; ) {
          var r = 2 * (t + 1),
            o = r - 1,
            s = null;
          if (o < e) {
            var a = this.content[o],
              l = this.scoreFunction(a);
            l < i && (s = o);
          }
          if (r < e) {
            var u = this.content[r];
            this.scoreFunction(u) < (null == s ? i : l) && (s = r);
          }
          if (null == s) break;
          ((this.content[t] = this.content[s]), (this.content[s] = n), (t = s));
        }
      },
    };
    class kt extends f.LineSegments {
      constructor(t, e = new f.Color(16776960)) {
        const n = new Uint16Array([
            0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7,
          ]),
          i = new Float32Array([
            t.min.x,
            t.min.y,
            t.min.z,
            t.max.x,
            t.min.y,
            t.min.z,
            t.max.x,
            t.min.y,
            t.max.z,
            t.min.x,
            t.min.y,
            t.max.z,
            t.min.x,
            t.max.y,
            t.min.z,
            t.max.x,
            t.max.y,
            t.min.z,
            t.max.x,
            t.max.y,
            t.max.z,
            t.min.x,
            t.max.y,
            t.max.z,
          ]),
          r = new f.BufferGeometry();
        (r.setIndex(new f.BufferAttribute(n, 1)),
          r.setAttribute('position', new f.BufferAttribute(i, 3)),
          super(r, new f.LineBasicMaterial({ color: e })));
      }
    }
    class Wt {
      constructor(t) {
        ((this.node = t), (this.next = null), (this.previous = null));
      }
    }
    class jt {
      constructor(t = 1e6) {
        ((this.pointBudget = t),
          (this.first = null),
          (this.last = null),
          (this.numPoints = 0),
          (this.items = new Map()));
      }
      get size() {
        return this.items.size;
      }
      has(t) {
        return this.items.has(t.id);
      }
      touch(t) {
        if (!t.loaded) return;
        const e = this.items.get(t.id);
        e ? this.touchExisting(e) : this.addNew(t);
      }
      addNew(t) {
        const e = new Wt(t);
        ((e.previous = this.last),
          (this.last = e),
          e.previous && (e.previous.next = e),
          this.first || (this.first = e),
          this.items.set(t.id, e),
          (this.numPoints += t.numPoints));
      }
      touchExisting(t) {
        t.previous
          ? t.next &&
            ((t.previous.next = t.next),
            (t.next.previous = t.previous),
            (t.previous = this.last),
            (t.next = null),
            (this.last = t),
            t.previous && (t.previous.next = t))
          : t.next &&
            ((this.first = t.next),
            (this.first.previous = null),
            (t.previous = this.last),
            (t.next = null),
            (this.last = t),
            t.previous && (t.previous.next = t));
      }
      remove(t) {
        const e = this.items.get(t.id);
        e &&
          (1 === this.items.size
            ? ((this.first = null), (this.last = null))
            : (e.previous || ((this.first = e.next), (this.first.previous = null)),
              e.next || ((this.last = e.previous), (this.last.next = null)),
              e.previous && e.next && ((e.previous.next = e.next), (e.next.previous = e.previous))),
          this.items.delete(t.id),
          (this.numPoints -= t.numPoints));
      }
      getLRUItem() {
        return this.first ? this.first.node : void 0;
      }
      freeMemory() {
        if (!(this.items.size <= 1))
          for (; this.numPoints > 2 * this.pointBudget; ) {
            const t = this.getLRUItem();
            t && this.disposeSubtree(t);
          }
      }
      disposeSubtree(t) {
        const e = [t];
        t.traverse((t) => {
          t.loaded && e.push(t);
        });
        for (const t of e) (t.dispose(), this.remove(t));
      }
    }
    class Kt {
      constructor(t, e, n, i) {
        ((this.pointCloudIndex = t), (this.weight = e), (this.node = n), (this.parent = i));
      }
    }
    const Xt = { v1: _t, v2: Vt };
    class qt {
      constructor(t = 'v1') {
        ((this._pointBudget = 1e6),
          (this._rendererSize = new f.Vector2()),
          (this.maxNumNodesLoading = 4),
          (this.features = ht),
          (this.lru = new jt(this._pointBudget)),
          (this.updateVisibilityStructures = (() => {
            const t = new f.Matrix4(),
              e = new f.Matrix4(),
              n = new f.Matrix4();
            return (i, r) => {
              const o = [],
                s = [],
                a = new Yt((t) => 1 / t.weight);
              for (let l = 0; l < i.length; l++) {
                const u = i[l];
                if (!u.initialized()) continue;
                ((u.numVisiblePoints = 0),
                  (u.visibleNodes = []),
                  (u.visibleGeometry = []),
                  r.updateMatrixWorld(!1));
                const d = r.matrixWorldInverse,
                  c = u.matrixWorld;
                if (
                  (t.identity().multiply(r.projectionMatrix).multiply(d).multiply(c),
                  o.push(new f.Frustum().setFromProjectionMatrix(t)),
                  e.copy(c).invert(),
                  n.identity().multiply(e).multiply(r.matrixWorld),
                  s.push(new f.Vector3().setFromMatrixPosition(n)),
                  u.visible && null !== u.root)
                ) {
                  const t = Number.MAX_VALUE;
                  a.push(new Kt(l, t, u.root));
                }
                Ht(u.root) && u.hideDescendants(u.root.sceneNode);
                for (const t of u.boundingBoxNodes) t.visible = !1;
              }
              return { frustums: o, cameraPositions: s, priorityQueue: a };
            };
          })()),
          (this.loadGeometry = Xt[t]));
      }
      loadPointCloud(t, e, n = (t, e) => fetch(t, e), i = !1) {
        return this.loadGeometry(t, e, n, i).then((t) => new dt(this, t, void 0, i));
      }
      updatePointClouds(t, e, n, i = () => {}) {
        const r = this.updateVisibility(t, e, n);
        for (let r = 0; r < t.length; r++) {
          const o = t[r];
          o.disposed ||
            (o.material.updateMaterial(o, o.visibleNodes, e, n),
            o.updateVisibleBounds(),
            o.updateBoundingBoxes(),
            n.getSize(this._rendererSize),
            o.updateSplats(e, this._rendererSize, i));
        }
        return (this.lru.freeMemory(), r);
      }
      static pick(t, e, n, i, r = {}) {
        return ((qt.picker = qt.picker || new ot()), qt.picker.pick(e, n, i, t, r));
      }
      get pointBudget() {
        return this._pointBudget;
      }
      set pointBudget(t) {
        t !== this._pointBudget &&
          ((this._pointBudget = t), (this.lru.pointBudget = t), this.lru.freeMemory());
      }
      static set maxLoaderWorkers(t) {
        yt.WORKER_POOL.maxWorkers = t;
      }
      static get maxLoaderWorkers() {
        return yt.WORKER_POOL.maxWorkers;
      }
      updateVisibility(t, e, n) {
        let i = 0;
        const r = [],
          o = [],
          {
            frustums: s,
            cameraPositions: a,
            priorityQueue: l,
          } = this.updateVisibilityStructures(t, e);
        let u,
          d = 0,
          c = !1,
          h = !1;
        for (; void 0 !== (u = l.pop()); ) {
          let f = u.node;
          if (i + f.numPoints > this.pointBudget) break;
          const p = u.pointCloudIndex,
            m = t[p],
            g = void 0 !== m.maxLevel ? m.maxLevel : 1 / 0;
          if (
            f.level > g ||
            !s[p].intersectsBox(f.boundingBox) ||
            this.shouldClip(m, f.boundingBox)
          )
            continue;
          ((i += f.numPoints), (m.numVisiblePoints += f.numPoints));
          const A = u.parent;
          if (Gt(f) && (!A || Ht(A)))
            if (f.loaded && d < 3) ((f = m.toTreeNode(f, A)), d++);
            else {
              if (f.failed) {
                h = !0;
                continue;
              }
              (f.loaded && d >= 3 && (c = !0), o.push(f), m.visibleGeometry.push(f));
            }
          Ht(f) && (this.updateTreeNodeVisibility(m, f, r), m.visibleGeometry.push(f.geometryNode));
          const v = 0.5 * n.getSize(this._rendererSize).height * n.getPixelRatio();
          this.updateChildVisibility(u, l, m, f, a[p], e, v);
        }
        const f = Math.min(this.maxNumNodesLoading, o.length),
          p = [];
        for (let t = 0; t < f; t++) p.push(o[t].load());
        return {
          visibleNodes: r,
          numVisiblePoints: i,
          exceededMaxLoadsToGPU: c,
          nodeLoadFailed: h,
          nodeLoadPromises: p,
        };
      }
      updateTreeNodeVisibility(t, e, n) {
        this.lru.touch(e.geometryNode);
        const i = e.sceneNode;
        ((i.visible = !0),
          (i.material = t.material),
          i.updateMatrix(),
          i.matrixWorld.multiplyMatrices(t.matrixWorld, i.matrix),
          n.push(e),
          t.visibleNodes.push(e),
          this.updateBoundingBoxVisibility(t, e));
      }
      updateChildVisibility(t, e, n, i, r, o, s) {
        const a = i.children;
        for (let l = 0; l < a.length; l++) {
          const u = a[l];
          if (null === u) continue;
          const d = u.boundingSphere,
            c = d.center.distanceTo(r),
            h = d.radius;
          let f = 0;
          if (o.type === m) {
            const t = (o.fov * Math.PI) / 180;
            f = s / (Math.tan(t / 2) * c);
          } else {
            const t = o;
            f = (2 * s) / (t.top - t.bottom);
          }
          const p = h * f;
          if (p < n.minNodePixelSize) continue;
          const g = c < h ? Number.MAX_VALUE : p + 1 / c;
          e.push(new Kt(t.pointCloudIndex, g, u, i));
        }
      }
      updateBoundingBoxVisibility(t, e) {
        if (t.showBoundingBox && !e.boundingBoxNode) {
          const n = new kt(e.boundingBox);
          ((n.matrixAutoUpdate = !1),
            t.boundingBoxNodes.push(n),
            (e.boundingBoxNode = n),
            e.boundingBoxNode.matrix.copy(t.matrixWorld));
        } else
          t.showBoundingBox && e.boundingBoxNode
            ? ((e.boundingBoxNode.visible = !0), e.boundingBoxNode.matrix.copy(t.matrixWorld))
            : !t.showBoundingBox && e.boundingBoxNode && (e.boundingBoxNode.visible = !1);
      }
      shouldClip(t, e) {
        const n = t.material;
        if (0 === n.numClipBoxes || n.clipMode !== o.CLIP_OUTSIDE) return !1;
        const i = e.clone();
        (t.updateMatrixWorld(!0), i.applyMatrix4(t.matrixWorld));
        const r = n.clipBoxes;
        for (let t = 0; t < r.length; t++) {
          const e = r[t].matrix,
            n = new f.Box3(
              new f.Vector3(-0.5, -0.5, -0.5),
              new f.Vector3(0.5, 0.5, 0.5),
            ).applyMatrix4(e);
          if (i.intersectsBox(n)) return !1;
        }
        return !0;
      }
    }
    return r;
  })(),
);
//# sourceMappingURL=potree.js.map
