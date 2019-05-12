#version 450
#extension GL_ARB_sparse_texture_clamp : enable

layout(set = 0, binding = 0) uniform sampler1D          samp1D[4];
layout(set = 1, binding = 0) uniform sampler2D          samp2D;
layout(set = 2, binding = 0) uniform sampler3D          samp3D;
layout(set = 3, binding = 0) uniform samplerCube        sampCube;
layout(set = 4, binding = 0) uniform sampler1DArray     samp1DArray;
layout(set = 5, binding = 0) uniform sampler2DArray     samp2DArray;
layout(set = 6, binding = 0) uniform samplerCubeArray   sampCubeArray;

layout(set = 7, binding = 0) uniform Uniforms
{
    int   index;
    float lodClamp;
};

layout(location = 0) out vec4 fragColor;

void main()
{
    fragColor = vec4(0.0);

    fragColor += textureGradClampARB(samp1D[index], 0.1, 0.2, 0.3, lodClamp);

    fragColor += textureGradClampARB(samp2D, vec2(0.1), vec2(0.2), vec2(0.3), lodClamp);

    fragColor += textureGradClampARB(samp3D, vec3(0.1), vec3(0.2), vec3(0.3), lodClamp);

    fragColor += textureGradClampARB(sampCube, vec3(0.1), vec3(0.2), vec3(0.3), lodClamp);

    fragColor += textureGradClampARB(samp1DArray, vec2(0.1), 0.2, 0.3, lodClamp);

    fragColor += textureGradClampARB(samp2DArray, vec3(0.1), vec2(0.2), vec2(0.3), lodClamp);

    fragColor += textureGradClampARB(sampCubeArray, vec4(0.1), vec3(0.2), vec3(0.3), lodClamp);
}

// BEGIN_SHADERTEST
/*
; RUN: amdllpc -spvgen-dir=%spvgendir% -v %gfxip %s | FileCheck -check-prefix=SHADERTEST %s

; SHADERTEST-LABEL: {{^// LLPC}} SPIRV-to-LLVM translation results
; SHADERTEST: <4 x float> @spirv.image.sample.f32.1D.grad.minlod({{.*}}, float 0x3FB99999A0000000, float 0x3FC99999A0000000, float 0x3FD3333340000000, {{.*}})
; SHADERTEST: <4 x float> @spirv.image.sample.f32.2D.grad.minlod({{.*}}, <2 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000>, <2 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000>, <2 x float> <float 0x3FD3333340000000, float 0x3FD3333340000000>, {{.*}})
; SHADERTEST:  <4 x float> @spirv.image.sample.f32.3D.grad.minlod({{.*}}, <3 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000>, <3 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FC99999A0000000>, <3 x float> <float 0x3FD3333340000000, float 0x3FD3333340000000, float 0x3FD3333340000000>, {{.*}})
; SHADERTEST: <4 x float> @spirv.image.sample.f32.Cube.grad.minlod({{.*}}, <3 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000>, <3 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FC99999A0000000>, <3 x float> <float 0x3FD3333340000000, float 0x3FD3333340000000, float 0x3FD3333340000000>, {{.*}})
; SHADERTEST: <4 x float> @spirv.image.sample.f32.1DArray.grad.minlod({{.*}}, <2 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000>, float 0x3FC99999A0000000, float 0x3FD3333340000000, {{.*}})
; SHADERTEST: <4 x float> @spirv.image.sample.f32.2DArray.grad.minlod({{.*}}, <3 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000>, <2 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000>, <2 x float> <float 0x3FD3333340000000, float 0x3FD3333340000000>, {{.*}})
; SHADERTEST: <4 x float> @spirv.image.sample.f32.CubeArray.grad.minlod({{.*}}, <4 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000>, <3 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FC99999A0000000>, <3 x float> <float 0x3FD3333340000000, float 0x3FD3333340000000, float 0x3FD3333340000000>, {{.*}})

; SHADERTEST-LABEL: {{^// LLPC}} SPIR-V lowering results
; SHADERTEST: call <4 x i32>{{.*}}@llpc.call.desc.load.sampler.v4i32
; SHADERTEST: call <8 x i32>{{.*}}@llpc.call.desc.load.resource.v8i32
; SHADERTEST: call <4 x float> @llpc.image.sample.f32.1D.grad.minlod{{.*}}({{.*}}, float 0x3FB99999A0000000, float 0x3FC99999A0000000, float 0x3FD3333340000000, {{.*}})
; SHADERTEST: call <4 x i32>{{.*}}@llpc.call.desc.load.sampler.v4i32
; SHADERTEST: call <8 x i32>{{.*}}@llpc.call.desc.load.resource.v8i32
; SHADERTEST: call <4 x float> @llpc.image.sample.f32.2D.grad.minlod{{.*}}({{.*}}, <2 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000>, <2 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000>, <2 x float> <float 0x3FD3333340000000, float 0x3FD3333340000000>, {{.*}})
; SHADERTEST: call <4 x i32>{{.*}}@llpc.call.desc.load.sampler.v4i32
; SHADERTEST: call <8 x i32>{{.*}}@llpc.call.desc.load.resource.v8i32
; SHADERTEST: call <4 x float> @llpc.image.sample.f32.3D.grad.minlod{{.*}}({{.*}}, <3 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000>, <3 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FC99999A0000000>, <3 x float> <float 0x3FD3333340000000, float 0x3FD3333340000000, float 0x3FD3333340000000>, {{.*}})
; SHADERTEST: call <4 x i32>{{.*}}@llpc.call.desc.load.sampler.v4i32
; SHADERTEST: call <8 x i32>{{.*}}@llpc.call.desc.load.resource.v8i32
; SHADERTEST: call <4 x float> @llpc.image.sample.f32.Cube.grad.minlod{{.*}}({{.*}}, <3 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000>, <3 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FC99999A0000000>, <3 x float> <float 0x3FD3333340000000, float 0x3FD3333340000000, float 0x3FD3333340000000>, {{.*}})
; SHADERTEST: call <4 x i32>{{.*}}@llpc.call.desc.load.sampler.v4i32
; SHADERTEST: call <8 x i32>{{.*}}@llpc.call.desc.load.resource.v8i32
; SHADERTEST: call <4 x float> @llpc.image.sample.f32.1DArray.grad.minlod{{.*}}({{.*}}, <2 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000>, float 0x3FC99999A0000000, float 0x3FD3333340000000, {{.*}})
; SHADERTEST: call <4 x i32>{{.*}}@llpc.call.desc.load.sampler.v4i32
; SHADERTEST: call <8 x i32>{{.*}}@llpc.call.desc.load.resource.v8i32
; SHADERTEST: call <4 x float> @llpc.image.sample.f32.2DArray.grad.minlod{{.*}}({{.*}}, <3 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000>, <2 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000>, <2 x float> <float 0x3FD3333340000000, float 0x3FD3333340000000>, {{.*}})
; SHADERTEST: call <4 x i32>{{.*}}@llpc.call.desc.load.sampler.v4i32
; SHADERTEST: call <8 x i32>{{.*}}@llpc.call.desc.load.resource.v8i32
; SHADERTEST: call <4 x float> @llpc.image.sample.f32.CubeArray.grad.minlod{{.*}}({{.*}}, <4 x float> <float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000>, <3 x float> <float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FC99999A0000000>, <3 x float> <float 0x3FD3333340000000, float 0x3FD3333340000000, float 0x3FD3333340000000>, {{.*}})

; SHADERTEST-LABEL: {{^// LLPC}} pipeline patching results
; SHADERTEST: call i32 @llvm.amdgcn.readfirstlane
; SHADERTEST: load <4 x i32>, <4 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: load <8 x i32>, <8 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.sample.d.cl.1d.v4f32.f32.f32({{.*}}, float 0x3FC99999A0000000, float 0x3FD3333340000000, float 0x3FB99999A0000000, {{.*}})
; SHADERTEST: load <4 x i32>, <4 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: load <8 x i32>, <8 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.sample.d.cl.2d.v4f32.f32.f32({{.*}}, float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FD3333340000000, float 0x3FD3333340000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000, {{.*}})
; SHADERTEST: load <4 x i32>, <4 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: load <8 x i32>, <8 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.sample.d.cl.3d.v4f32.f32.f32({{.*}}, float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FD3333340000000, float 0x3FD3333340000000, float 0x3FD3333340000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000, {{.*}})
; SHADERTEST: load <4 x i32>, <4 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: load <8 x i32>, <8 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: call float @llvm.amdgcn.cubesc(float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000)
; SHADERTEST: call float @llvm.amdgcn.cubetc(float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000)
; SHADERTEST: call float @llvm.amdgcn.cubema(float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000)
; SHADERTEST: call float @llvm.amdgcn.cubeid(float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000)
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.sample.d.cl.cube.v4f32.f32.f32
; SHADERTEST: load <4 x i32>, <4 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: load <8 x i32>, <8 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.sample.d.cl.1darray.v4f32.f32.f32({{.*}}, float 0x3FC99999A0000000, float 0x3FD3333340000000, float 0x3FB99999A0000000, float 0.000000e+00, {{.*}})
; SHADERTEST: load <4 x i32>, <4 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: load <8 x i32>, <8 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.sample.d.cl.2darray.v4f32.f32.f32({{.*}}, float 0x3FC99999A0000000, float 0x3FC99999A0000000, float 0x3FD3333340000000, float 0x3FD3333340000000, float 0x3FB99999A0000000, float 0x3FB99999A0000000, float 0.000000e+00, {{.*}})
; SHADERTEST: load <4 x i32>, <4 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: load <8 x i32>, <8 x i32> addrspace(4)* %{{[0-9]*}}
; SHADERTEST: call <4 x float> @llvm.amdgcn.image.sample.d.cl.cube.v4f32.f32.f32

; SHADERTEST: AMDLLPC SUCCESS
*/
// END_SHADERTEST
