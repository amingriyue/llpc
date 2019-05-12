#version 450

layout(set = 0, binding = 0) buffer INPUT
{
    int   imem;
    uint  umem[4];
};

layout(set = 0, binding = 1) buffer OUTPUT
{
    uvec4 u4;
};

layout(set = 1, binding = 0) uniform Uniforms
{
    int   idata;
    uint  udata;

    int index;
};

void main()
{
    int i1 = atomicAdd(imem, idata);
    i1 += atomicMin(imem, idata);
    i1 += atomicMax(imem, idata);
    i1 += atomicAnd(imem, idata);
    i1 += atomicOr(imem, idata);
    i1 += atomicXor(imem, idata);
    i1 += atomicExchange(imem, idata);
    i1 += atomicCompSwap(imem, 28, idata);

    uint u1 = atomicAdd(umem[0], udata);
    u1 += atomicMin(umem[1], udata);
    u1 += atomicMax(umem[2], udata);
    u1 += atomicAnd(umem[3], udata);
    u1 += atomicOr(umem[index], udata);
    u1 += atomicXor(umem[index], udata);
    u1 += atomicExchange(umem[index], udata);
    u1 += atomicCompSwap(umem[index], 16u, udata);

    u4[i1 % 4] = u1;
}
// BEGIN_SHADERTEST
/*
; RUN: amdllpc -spvgen-dir=%spvgendir% -v %gfxip %s | FileCheck -check-prefix=SHADERTEST %s

; SHADERTEST-LABEL: {{^// LLPC}} SPIR-V lowering results
; SHADERTEST: atomicrmw add i32 {{.*}} monotonic
; SHADERTEST: atomicrmw min i32 {{.*}} monotonic
; SHADERTEST: atomicrmw max i32 {{.*}} monotonic
; SHADERTEST: atomicrmw and i32 {{.*}} monotonic
; SHADERTEST: atomicrmw or i32 {{.*}} monotonic
; SHADERTEST: atomicrmw xor i32 {{.*}} monotonic
; SHADERTEST: atomicrmw xchg i32 {{.*}} monotonic
; SHADERTEST: cmpxchg i32 {{.*}} monotonic monotonic
; SHADERTEST: atomicrmw add i32 {{.*}} monotonic
; SHADERTEST: atomicrmw umin i32 {{.*}} monotonic
; SHADERTEST: atomicrmw umax i32 {{.*}} monotonic
; SHADERTEST: atomicrmw and i32 {{.*}} monotonic
; SHADERTEST: atomicrmw or i32 {{.*}} monotonic
; SHADERTEST: atomicrmw xor i32 {{.*}} monotonic
; SHADERTEST: atomicrmw xchg i32 {{.*}} monotonic
; SHADERTEST: cmpxchg i32 {{.*}} monotonic monotonic

; SHADERTEST-LABEL: {{^// LLPC}} pipeline patching results
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.add.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 0, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.smin.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 0, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.smax.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 0, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.and.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 0, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.or.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 0, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.xor.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 0, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.swap.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 0, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.buffer.atomic.cmpswap(i32 %{{[0-9]*}}, i32 28, <4 x i32> %{{[0-9]*}}, i32 0, i32 0, i1 false)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.add.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 4, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.umin.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 8, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.umax.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 12, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.and.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 16, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.or.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 %{{[0-9]*}}, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.xor.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 %{{[0-9]*}}, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.raw.buffer.atomic.swap.i32(i32 %{{[0-9]*}}, <4 x i32> %{{[0-9]*}}, i32 %{{[0-9]*}}, i32 0, i32 0)
; SHADERTEST: call i32 @llvm.amdgcn.buffer.atomic.cmpswap(i32 %{{[0-9]*}}, i32 16, <4 x i32> %{{[0-9]*}}, i32 0, i32 %{{[0-9]*}}, i1 false)

; SHADERTEST: AMDLLPC SUCCESS
*/
// END_SHADERTEST
