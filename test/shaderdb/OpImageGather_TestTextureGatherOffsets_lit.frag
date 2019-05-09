#version 450

layout(set = 0, binding = 0) uniform sampler2D      samp2D;
layout(set = 1, binding = 0) uniform sampler2DArray samp2DArray[4];
layout(set = 0, binding = 1) uniform sampler2DRect  samp2DRect;

layout(set = 2, binding = 0) uniform Uniforms
{
    int index;
};

layout(location = 0) out vec4 fragColor;

void main()
{
    const ivec2 i2[4] = { ivec2(1), ivec2(2), ivec2(3), ivec2(4) };

    vec4 f4 = textureGatherOffsets(samp2D, vec2(0.1), i2, 2);
    f4 += textureGatherOffsets(samp2DArray[index], vec3(0.2), i2, 3);
    f4 += textureGatherOffsets(samp2DRect, vec2(1.0), i2);

    fragColor = f4;
}
// BEGIN_SHADERTEST
/*
; RUN: amdllpc -spvgen-dir=%spvgendir% -v %gfxip %s | FileCheck -check-prefix=SHADERTEST %s
; SHADERTEST-LABEL: {{^// LLPC}} SPIRV-to-LLVM translation results
; SHADERTEST-LABEL: {{^// LLPC}}  SPIR-V lowering results
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 0, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2D.constoffsets{{.*}}({{.*}},{{.*}}, <2 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000>, i32 2, [4 x <2 x i32>] [<2 x i32> <i32 1, i32 1>, <2 x i32> <i32 2, i32 2>, <2 x i32> <i32 3, i32 3>, <2 x i32> <i32 4, i32 4>],{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 1, i32 0,{{.*}}, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 1, i32 0,{{.*}}, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.2DArray.constoffsets{{.*}}({{.*}},{{.*}}, <3 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FC99999A0000000>, i32 3, [4 x <2 x i32>] [<2 x i32> <i32 1, i32 1>, <2 x i32> <i32 2, i32 2>, <2 x i32> <i32 3, i32 3>, <2 x i32> <i32 4, i32 4>],{{.*}})
; SHADERTEST: call <4 x i32> {{.*}} @llpc.call.desc.load.sampler.v4i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <8 x i32> {{.*}} @llpc.call.desc.load.resource.v8i32(i32 0, i32 1, i32 0, i1 false)
; SHADERTEST: call <4 x float> @llpc.image.gather.f32.Rect.constoffsets{{.*}}({{.*}},{{.*}}, <2 x float> <float 1.000000e+00, float 1.000000e+00>, i32 0, [4 x <2 x i32>] [<2 x i32> <i32 1, i32 1>, <2 x i32> <i32 2, i32 2>, <2 x i32> <i32 3, i32 3>, <2 x i32> <i32 4, i32 4>],{{.*}})

; SHADERTEST-LABEL: {{^// LLPC}}  pipeline patching results
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2d.v4f32.f32(i32 4, i32 257, float 0x3FB99999A0000000, float 0x3FB99999A0000000,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2d.v4f32.f32(i32 4, i32 514, float 0x3FB99999A0000000, float 0x3FB99999A0000000,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2d.v4f32.f32(i32 4, i32 771, float 0x3FB99999A0000000, float 0x3FB99999A0000000,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2d.v4f32.f32(i32 4, i32 1028, float 0x3FB99999A0000000, float 0x3FB99999A0000000,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2darray.v4f32.f32(i32 8, i32 257, float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0.000000e+00,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2darray.v4f32.f32(i32 8, i32 514, float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0.000000e+00,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2darray.v4f32.f32(i32 8, i32 771, float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0.000000e+00,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2darray.v4f32.f32(i32 8, i32 1028, float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0.000000e+00,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2d.v4f32.f32(i32 1, i32 257, float 1.000000e+00, float 1.000000e+00,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2d.v4f32.f32(i32 1, i32 514, float 1.000000e+00, float 1.000000e+00,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2d.v4f32.f32(i32 1, i32 771, float 1.000000e+00, float 1.000000e+00,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.gather4.lz.o.2d.v4f32.f32(i32 1, i32 1028, float 1.000000e+00, float 1.000000e+00,{{.*}},{{.*}}, i1 false, i32 0, i32 0)
; SHADERTEST: AMDLLPC SUCCESS
*/
// END_SHADERTEST
