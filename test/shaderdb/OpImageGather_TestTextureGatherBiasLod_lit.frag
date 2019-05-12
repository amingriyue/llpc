#version 450 core

#extension GL_AMD_texture_gather_bias_lod: enable

layout(binding = 0) uniform sampler2D           s2D;
layout(binding = 1) uniform sampler2DArray      s2DArray;
layout(binding = 2) uniform samplerCube         sCube;
layout(binding = 3) uniform samplerCubeArray    sCubeArray;

layout(location = 1) in vec2 c2;
layout(location = 2) in vec3 c3;
layout(location = 3) in vec4 c4;

layout(location = 4) in float lod;
layout(location = 5) in float bias;

layout(location = 0) out vec4 fragColor;

void main()
{
    vec4 texel  = vec4(0.0);
    vec4 result = vec4(0.0);

    const ivec2 offsets[4] = { ivec2(0, 0), ivec2(0, 1), ivec2(1, 0), ivec2(1, 1) };

    texel += textureGather(s2D,        c2, 0, bias);

    texel += textureGather(s2DArray,   c3, 1, bias);
    texel += textureGather(sCube,      c3, 2, bias);
    texel += textureGather(sCubeArray, c4, 3, bias);

    texel += textureGatherOffset(s2D,        c2, offsets[0], 0, bias);
    texel += textureGatherOffset(s2DArray,   c3, offsets[1], 1, bias);

    texel += textureGatherOffsets(s2D,        c2, offsets, 0, bias);
    texel += textureGatherOffsets(s2DArray,   c3, offsets, 1, bias);

    texel += textureGatherLodAMD(s2D,        c2, lod);
    texel += textureGatherLodAMD(s2DArray,   c3, lod, 1);
    texel += textureGatherLodAMD(sCube,      c3, lod, 2);
    texel += textureGatherLodAMD(sCubeArray, c4, lod, 3);

    texel += textureGatherLodOffsetAMD(s2D,        c2, lod, offsets[0]);
    texel += textureGatherLodOffsetAMD(s2DArray,   c3, lod, offsets[1], 1);

    texel += textureGatherLodOffsetsAMD(s2D,       c2, lod, offsets);
    texel += textureGatherLodOffsetsAMD(s2DArray,  c3, lod, offsets, 1);

    fragColor = texel;
}
// BEGIN_SHADERTEST
/*
; RUN: amdllpc -spvgen-dir=%spvgendir% -v %gfxip %s | FileCheck -check-prefix=SHADERTEST %s
; SHADERTEST-LABEL: {{^// LLPC}} SPIRV-to-LLVM translation results
; SHADERTEST-LABEL: {{^// LLPC}}  SPIR-V lowering results
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2D.bias{{.*}}({{.*}},{{.*}},{{.*}}, i32 0,{{.*}},{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2DArray.bias{{.*}}({{.*}},{{.*}},{{.*}}, i32 1,{{.*}},{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 2, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 2, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.Cube.bias{{.*}}({{.*}},{{.*}},{{.*}}, i32 2,{{.*}},{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 3, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 3, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.CubeArray.bias{{.*}}({{.*}},{{.*}},{{.*}}, i32 3,{{.*}},{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2D.bias.constoffset{{.*}}({{.*}},{{.*}},{{.*}}, i32 0,{{.*}}, <2 x i32> zeroinitializer,{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2DArray.bias.constoffset{{.*}}({{.*}},{{.*}},{{.*}}, i32 1,{{.*}}, <2 x i32> <i32 0, i32 1>,{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2D.bias.constoffsets{{.*}}({{.*}},{{.*}},{{.*}}, i32 0,{{.*}}, [4 x <2 x i32>] [<2 x i32> zeroinitializer, <2 x i32> <i32 0, i32 1>, <2 x i32> <i32 1, i32 0>, <2 x i32> <i32 1, i32 1>],{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2DArray.bias.constoffsets{{.*}}({{.*}},{{.*}},{{.*}}, i32 1,{{.*}}, [4 x <2 x i32>] [<2 x i32> zeroinitializer, <2 x i32> <i32 0, i32 1>, <2 x i32> <i32 1, i32 0>, <2 x i32> <i32 1, i32 1>],{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2D.lod{{.*}}({{.*}},{{.*}},{{.*}}, i32 0,{{.*}},{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2DArray.lod{{.*}}({{.*}},{{.*}},{{.*}}, i32 1,{{.*}},{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 2, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 2, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.Cube.lod{{.*}}({{.*}},{{.*}},{{.*}}, i32 2,{{.*}},{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 3, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 3, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.CubeArray.lod{{.*}}({{.*}},{{.*}},{{.*}}, i32 3,{{.*}},{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2D.lod.constoffset{{.*}}({{.*}},{{.*}},{{.*}}, i32 0,{{.*}}, <2 x i32> zeroinitializer,{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2DArray.lod.constoffset{{.*}}({{.*}},{{.*}},{{.*}}, i32 1,{{.*}}, <2 x i32> <i32 0, i32 1>,{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2D.lod.constoffsets{{.*}}({{.*}},{{.*}},{{.*}}, i32 0,{{.*}}, [4 x <2 x i32>] [<2 x i32> zeroinitializer, <2 x i32> <i32 0, i32 1>, <2 x i32> <i32 1, i32 0>, <2 x i32> <i32 1, i32 1>],{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2DArray.lod.constoffsets{{.*}}({{.*}},{{.*}},{{.*}}, i32 1,{{.*}}, [4 x <2 x i32>] [<2 x i32> zeroinitializer, <2 x i32> <i32 0, i32 1>, <2 x i32> <i32 1, i32 0>, <2 x i32> <i32 1, i32 1>],{{.*}})

; SHADERTEST-LABEL: {{^// LLPC}}  pipeline patching results
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.2d.v4f32.f32.f32(i32 1,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.2darray.v4f32.f32.f32(i32 2,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.cube.v4f32.f32.f32(i32 4,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.cube.v4f32.f32.f32(i32 8,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.o.2d.v4f32.f32.f32(i32 1, i32 0,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.o.2darray.v4f32.f32.f32(i32 2, i32 256,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.o.2d.v4f32.f32.f32(i32 1, i32 256,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.o.2d.v4f32.f32.f32(i32 1, i32 1,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.o.2d.v4f32.f32.f32(i32 1, i32 257,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.o.2darray.v4f32.f32.f32(i32 2, i32 0,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.o.2darray.v4f32.f32.f32(i32 2, i32 1,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.b.o.2darray.v4f32.f32.f32(i32 2, i32 257,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.2d.v4f32.f32(i32 1,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.2darray.v4f32.f32(i32 2,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.cube.v4f32.f32(i32 4,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.cube.v4f32.f32(i32 8,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.o.2d.v4f32.f32(i32 1, i32 0,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.o.2darray.v4f32.f32(i32 2, i32 256,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.o.2d.v4f32.f32(i32 1, i32 256,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.o.2d.v4f32.f32(i32 1, i32 1,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.o.2d.v4f32.f32(i32 1, i32 257,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.o.2darray.v4f32.f32(i32 2, i32 0,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.o.2darray.v4f32.f32(i32 2, i32 1,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.l.o.2darray.v4f32.f32(i32 2, i32 257,{{.*}},{{.*}},{{.*}},{{.*}},{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: AMDLLPC SUCCESS
*/
// END_SHADERTEST
