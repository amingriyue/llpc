/*
 ***********************************************************************************************************************
 *
 *  Copyright (c) 2020 Advanced Micro Devices, Inc. All Rights Reserved.
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in all
 *  copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *  SOFTWARE.
 *
 **********************************************************************************************************************/
/**
 ***********************************************************************************************************************
 * @file  ElfLinker.cpp
 * @brief LLPC source file: Implementation class for linking unlinked half-pipeline ELFs into pipeline ELF
 ***********************************************************************************************************************
 */
#include "lgc/ElfLinker.h"
#include "RelocHandler.h"
#include "lgc/state/AbiMetadata.h"
#include "lgc/state/PalMetadata.h"
#include "lgc/state/PipelineState.h"
#include "lgc/state/TargetInfo.h"
#include "llvm/ADT/SmallVector.h"
#include "llvm/BinaryFormat/ELF.h"
#include "llvm/Object/ELFObjectFile.h"
#include "llvm/Support/MemoryBuffer.h"
#include "llvm/Support/raw_ostream.h"

#define DEBUG_TYPE "lgc-elf-linker"

using namespace lgc;
using namespace llvm;

namespace {

class ElfLinkerImpl;

// =====================================================================================================================
// An ELF input to the linker
struct ElfInput {
  std::unique_ptr<object::ObjectFile> objectFile;
  SmallVector<std::pair<unsigned, unsigned>, 4> sectionMap;
};

// =====================================================================================================================
// A single input section
struct InputSection {
  InputSection(object::SectionRef sectionRef) : sectionRef(sectionRef), size(sectionRef.getSize()) {}
  object::SectionRef sectionRef; // Section from the input ELF
  size_t offset = 0;             // Offset within the output ELF section
  uint64_t size;                 // Size, possibly after removing s_end_code padding
};

// =====================================================================================================================
// A single output section
class OutputSection {
public:
  // Constructor given name and optional SHT_* section type
  OutputSection(ElfLinkerImpl *linker, StringRef name = "", unsigned type = 0)
      : m_linker(linker), m_name(name), m_type(type) {}

  // Add an input section
  void addInputSection(ElfInput &elfInput, object::SectionRef inputSection);

  // Get name of output section
  StringRef getName();

  // Get the section index in the output file
  unsigned getIndex();

  // Set the layout of this output section, allowing for alignment required by input sections.
  void layout();

  // Add a symbol to the output symbol table
  void addSymbol(const object::ELFSymbolRef &elfSymRef, unsigned inputSectIdx);

  // Get the output file offset of a particular input section in the output section
  uint64_t getOutputOffset(unsigned inputIdx) { return m_offset + m_inputSections[inputIdx].offset; }

  // Get the overall alignment requirement, after calling layout().
  uint64_t getAlignment() const { return m_alignment; }

  // Write the output section
  void write(raw_pwrite_stream &outStream, ELF::Elf64_Shdr *shdr);

private:
  // Get alignment for an input section.
  uint64_t getAlignment(const InputSection &inputSection);

  ElfLinkerImpl *m_linker;
  uint64_t m_offset;                            // File offset of this output section
  SmallVector<InputSection, 4> m_inputSections; // Input sections contributing to this output section
  StringRef m_name;                             // Section name
  unsigned m_type;                              // Section type (SHT_* value)
  uint64_t m_alignment = 0;                     // Overall alignment required for the section
};

// =====================================================================================================================
// Internal implementation of the LGC interface for ELF linking.
class ElfLinkerImpl final : public ElfLinker {
public:
  // Constructor given PipelineState and ELFs to link
  ElfLinkerImpl(PipelineState *pipelineState, ArrayRef<MemoryBufferRef> elfs);

  // Destructor
  ~ElfLinkerImpl() override final;

  // -----------------------------------------------------------------------------------------------------------------
  // Implementations of ElfLinker methods exposed to the front-end

  // Get information on the glue code that will be needed for the link
  llvm::ArrayRef<StringRef> getGlueInfo() override final;

  // Add a blob for a particular chunk of glue code, typically retrieved from a cache
  void addGlue(unsigned glueIndex, StringRef blob) override final;

  // Compile a particular chunk of glue code and retrieve its blob
  StringRef compileGlue(unsigned glueIndex) override final;

  // Link the unlinked half-pipeline ELFs and the compiled glue code into a pipeline ELF
  bool link(raw_pwrite_stream &outStream) override final;

  // -----------------------------------------------------------------------------------------------------------------
  // Accessors

  PipelineState *getPipelineState() const { return m_pipelineState; }
  ArrayRef<OutputSection> getOutputSections() { return m_outputSections; }
  StringRef getStrings() { return m_strings; }
  SmallVectorImpl<ELF::Elf64_Sym> &getSymbols() { return m_symbols; }
  void setStringTableIndex(unsigned index) { m_ehdr.e_shstrndx = index; }
  StringRef getNotes() { return m_notes; }

  // Get string index in output ELF, adding to string table if necessary
  unsigned getStringIndex(StringRef string);

  // Find symbol in output ELF
  unsigned findSymbol(unsigned nameIndex);

private:
  // Get the value of the symbol referenced in a reloc
  uint64_t getRelocValue(object::RelocationRef reloc);

  // Find where an input section contributes to an output section
  std::pair<unsigned, unsigned> findInputSection(ElfInput &elfInput, object::SectionRef section);

  // Read PAL metadata from an ELF file and merge it in to the PAL metadata that we already have
  void mergePalMetadataFromElf(object::ObjectFile &objectFile);

  // Write the PAL metadata out into the .note section.
  void writePalMetadata();

  PipelineState *m_pipelineState;                 // PipelineState object
  RelocHandler m_relocHandler;                    // RelocHandler object
  SmallVector<ElfInput, 5> m_elfInputs;           // ELF objects to link
  ELF::Elf64_Ehdr m_ehdr;                         // Output ELF header, copied from first input
  SmallVector<OutputSection, 4> m_outputSections; // Output sections
  SmallVector<ELF::Elf64_Sym, 8> m_symbols;       // Symbol table
  StringMap<unsigned> m_symbolMap;                // Map from name to symbol index
  std::string m_strings;                          // Strings for string table
  StringMap<unsigned> m_stringMap;                // Map from string to string table index
  std::string m_notes;                            // Notes to go in .note section
};

} // anonymous namespace

namespace lgc {
// =====================================================================================================================
// Create ELF linker given PipelineState and ELFs to link
ElfLinker *createElfLinkerImpl(PipelineState *pipelineState, ArrayRef<MemoryBufferRef> elfs) {
  return new ElfLinkerImpl(pipelineState, elfs);
}

} // namespace lgc

namespace llvm {
// =====================================================================================================================
// Temporary cantFail override to cope with a forthcoming change of the return type of ELFSymbolRef::getValue
// from uint64_t to Expected<uint64_t>.
inline uint64_t cantFail(uint64_t value, const char *Msg = nullptr) {
  return value;
}
} // namespace llvm

// =====================================================================================================================
// Constructor given PipelineState and ELFs to link
//
// @param pipelineState : PipelineState object
// @param elfs : Array of unlinked ELF modules to link
ElfLinkerImpl::ElfLinkerImpl(PipelineState *pipelineState, ArrayRef<MemoryBufferRef> elfs)
    : m_pipelineState(pipelineState), m_relocHandler(pipelineState) {
  // For each input ELF, create an ELF object for it.
  for (auto elfBuffer : elfs)
    m_elfInputs.push_back({cantFail(object::ObjectFile::createELFObjectFile(elfBuffer))});

  // Gather and merge PAL metadata.
  m_pipelineState->clearPalMetadata();
  for (auto &elfInput : m_elfInputs)
    mergePalMetadataFromElf(*elfInput.objectFile);

  // Populate output ELF header
  memcpy(&m_ehdr, elfs[0].getBuffer().data(), sizeof(ELF::Elf64_Ehdr));
}

// =====================================================================================================================
// Destructor
ElfLinkerImpl::~ElfLinkerImpl() {
}

// =====================================================================================================================
// Get information on the glue code that will be needed for the link. It is an implementation detail how many
// chunks of glue there might be and what they are for, but, for information, they will be some subset of:
// - A CS prolog
// - A VS prolog ("fetch shader")
// - A vertex-processing epilog ("parameter export shader")
// - An FS epilog ("color export shader")
//
// Returns an array (possibly 0 length) with an entry for each chunk of glue code, where an entry
// is a StringRef that the client can hash for its cache lookup. If it gets a cache hit, it should provide the
// found blob to ElfLinker::addGlue. If it does not get a cache hit, the client can call ElfLinker::compileGlue to
// retrieve the compiled glue code to store in the cache.
ArrayRef<StringRef> ElfLinkerImpl::getGlueInfo() {
  llvm_unreachable("Not implemented");
}

// =====================================================================================================================
// Add a blob for a particular chunk of glue code, typically retrieved from a cache. The blob is not copied,
// and remains in use until the first of the link completing or the ElfLinker's parent Pipeline being destroyed.
//
// @param glueIndex : Index into the array that was returned by getGlueInfo()
// @param blob : Blob for the glue code
void ElfLinkerImpl::addGlue(unsigned glueIndex, StringRef blob) {
  llvm_unreachable("Not implemented");
}

// =====================================================================================================================
// Compile a particular chunk of glue code and retrieve its blob. The returned blob remains valid until the first
// of calling link() or the ElfLinker's parent Pipeline being destroyed. It is optional to call this; any chunk
// of glue code that has not had one of addGlue() or compileGlue() done by the time link() is called will be
// internally compiled. The client only needs to call this if it wants to cache the glue code's blob.
//
// @param glueIndex : Index into the array that was returned by getGlueInfo()
// @return : The blob. A zero-length blob indicates that a recoverable error occurred, and link() will also return
//           and empty ELF blob.
StringRef ElfLinkerImpl::compileGlue(unsigned glueIndex) {
  llvm_unreachable("Not implemented");
}

// =====================================================================================================================
// Link the unlinked half-pipeline ELFs and the compiled glue code into a pipeline ELF.
// Three ways this can exit:
// 1. On success, returns true.
// 2. Returns false on failure due to something in the shaders or pipeline state making separate
//    compilation and linking impossible. The client typically then does a whole-pipeline
//    compilation instead. The client can call Pipeline::getLastError() to get a textual representation of the
//    error, for use in logging or in error reporting in a command-line utility.
// 3. Other failures cause exit by report_fatal_error. The client can that catch by setting a diagnostic handler
//    with LLVMContext::setDiagnosticHandler, although the usefulness of that is limited, as no attempt is
//    made by LLVM to avoid memory leaks.
//
// @param [out] outStream : Stream to write linked ELF to
// @return : True for success, false if something about the pipeline state stops linking
bool ElfLinkerImpl::link(raw_pwrite_stream &outStream) {
  // Initialize symbol table and string table
  m_symbols.push_back({});
  m_strings = std::string("", 1);
  m_stringMap[""] = 0;
  // Pre-create four fixed sections at the start:
  // 0: unused (per ELF spec)
  // 1: string table
  // 2: symbol table
  // 3: .text
  // 4: .note
  m_outputSections.push_back(OutputSection(this, "", ELF::SHT_NULL));
  m_outputSections.push_back(OutputSection(this, ".strtab", ELF::SHT_STRTAB));
  m_outputSections.push_back(OutputSection(this, ".symtab", ELF::SHT_SYMTAB));
  unsigned textSectionIdx = m_outputSections.size();
  m_outputSections.push_back(OutputSection(this, ".text"));
  m_outputSections.push_back(OutputSection(this, ".note", ELF::SHT_NOTE));

  // Allocate input sections to output sections.
  for (auto &elfInput : m_elfInputs) {
    for (const object::SectionRef &section : elfInput.objectFile->sections()) {
      object::ELFSectionRef elfSection(section);
      if (elfSection.getType() == ELF::SHT_PROGBITS &&
          (elfSection.getFlags() & (ELF::SHF_ALLOC | ELF::SHF_WRITE)) == ELF::SHF_ALLOC) {
        // All text and rodata sections get lumped together, even if they have different names.
        m_outputSections[textSectionIdx].addInputSection(elfInput, section);
      } else if (elfSection.getType() == ELF::SHT_PROGBITS) {
        // Put same-named sections together (excluding symbol table, string table, reloc sections).
        StringRef name = cantFail(section.getName());
        for (unsigned idx = 1;; ++idx) {
          if (idx == m_outputSections.size()) {
            m_outputSections.push_back(OutputSection(this));
            m_outputSections[idx].addInputSection(elfInput, section);
            break;
          }
          if (name == m_outputSections[idx].getName()) {
            m_outputSections[idx].addInputSection(elfInput, section);
            break;
          }
        }
      }
    }
  }

  // Construct uninitialized section table, and write partly-initialized ELF header and uninitialized
  // section table as a placeholder.
  assert(outStream.tell() == 0);
  SmallVector<ELF::Elf64_Shdr, 8> shdrs(m_outputSections.size());
  m_ehdr.e_shoff = sizeof(m_ehdr);
  m_ehdr.e_shnum = m_outputSections.size();
  outStream << StringRef(reinterpret_cast<const char *>(&m_ehdr), sizeof(m_ehdr));
  outStream << StringRef(reinterpret_cast<const char *>(shdrs.data()), sizeof(ELF::Elf64_Shdr) * shdrs.size());

  // Allow each output section to fix its layout. Also ensure that its name is in the string table.
  for (OutputSection &outputSection : m_outputSections) {
    outputSection.layout();
    getStringIndex(outputSection.getName());
  }

  // Find public symbols in the input ELFs, and add them to the output ELF.
  for (auto &elfInput : m_elfInputs) {
    for (object::SymbolRef symRef : elfInput.objectFile->symbols()) {
      object::ELFSymbolRef elfSymRef(symRef);
      if (elfSymRef.getBinding() == ELF::STB_GLOBAL) {
        object::section_iterator containingSect = cantFail(elfSymRef.getSection());
        if (containingSect != elfInput.objectFile->section_end()) {
          auto outputIndices = findInputSection(elfInput, *containingSect);
          if (outputIndices.first != UINT_MAX)
            m_outputSections[outputIndices.first].addSymbol(elfSymRef, outputIndices.second);
        }
      }
    }
  }

  // Write the PAL metadata out into the .note section.
  writePalMetadata();

  // Output each section, and let it set its section table entry.
  // Ensure each section is aligned in the file by the minimum of 4 and its address alignment requirement.
  // I am not sure if that is actually required by the ELF standard, but vkgcPipelineDumper.cpp relies on
  // it when dumping .note records.
  for (unsigned sectionIndex = 0; sectionIndex != shdrs.size(); ++sectionIndex) {
    OutputSection &outputSection = m_outputSections[sectionIndex];
    unsigned align = std::min(unsigned(outputSection.getAlignment()), 4U);
    outStream << StringRef("\0\0\0", 3).slice(0, -outStream.tell() & align - 1);
    shdrs[sectionIndex].sh_offset = outStream.tell();
    outputSection.write(outStream, &shdrs[sectionIndex]);
  }

  // Apply the relocs
  for (auto &elfInput : m_elfInputs) {
    for (const object::SectionRef section : elfInput.objectFile->sections()) {
      unsigned sectType = object::ELFSectionRef(section).getType();
      if (sectType == ELF::SHT_REL || sectType == ELF::SHT_RELA) {
        for (object::RelocationRef reloc : section.relocations()) {
          unsigned outputSectIdx = UINT_MAX;
          unsigned withinSectIdx = UINT_MAX;
          std::tie(outputSectIdx, withinSectIdx) = findInputSection(elfInput, *cantFail(section.getRelocatedSection()));
          if (outputSectIdx != UINT_MAX) {
            uint64_t inputOffset = reloc.getOffset();
            uint64_t outputOffset = m_outputSections[outputSectIdx].getOutputOffset(withinSectIdx) + inputOffset;
            uint64_t addend = 0;
            if (sectType == ELF::SHT_RELA)
              addend = cantFail(object::ELFRelocationRef(reloc).getAddend());
            uint64_t value = getRelocValue(reloc);

            switch (reloc.getType()) {

            case ELF::R_AMDGPU_ABS32: {
              StringRef contents = cantFail(cantFail(section.getRelocatedSection())->getContents());
              assert(inputOffset + sizeof(uint32_t) <= contents.size() && "Out of range reloc offset");
              if (sectType == ELF::SHT_REL)
                addend = *reinterpret_cast<const uint32_t *>(contents.data() + inputOffset);
              uint32_t inst = addend + value;
              outStream.pwrite(reinterpret_cast<const char *>(&inst), sizeof(inst), outputOffset);
              break;
            }

            default:
              report_fatal_error("Reloc not supported");
            }
          }
        }
      }
    }
  }

  // Go back and write the now-complete ELF header and section table.
  outStream.pwrite(reinterpret_cast<const char *>(&m_ehdr), sizeof(m_ehdr), 0);
  outStream.pwrite(reinterpret_cast<const char *>(shdrs.data()), sizeof(ELF::Elf64_Shdr) * shdrs.size(),
                   sizeof(m_ehdr));

  return m_pipelineState->getLastError() == "";
}

// =====================================================================================================================
// Get string index in output ELF, adding to string table if necessary
unsigned ElfLinkerImpl::getStringIndex(StringRef string) {
  if (string == "")
    return 0;
  auto &stringMapEntry = m_stringMap[string];
  if (!stringMapEntry) {
    stringMapEntry = m_strings.size();
    m_strings += string;
    m_strings += '\0';
  }
  return stringMapEntry;
}

// =====================================================================================================================
// Find symbol in output ELF
//
// @param nameIndex : Index of symbol name in string table
// @return : Index in symbol table, or 0 if not found
unsigned ElfLinkerImpl::findSymbol(unsigned nameIndex) {
  for (auto &sym : getSymbols()) {
    if (sym.st_name == nameIndex)
      return &sym - getSymbols().data();
  }
  return 0;
}

// =====================================================================================================================
// Get the value of the symbol referenced in a reloc
uint64_t ElfLinkerImpl::getRelocValue(object::RelocationRef reloc) {
  StringRef name = cantFail(reloc.getSymbol()->getName());

  // Handle the special case relocs from pipeline state
  uint64_t value = 0;
  if (m_relocHandler.getValue(name, value))
    return value;

  // TODO: Handle a reloc to a symbol, so we are then able to generate a shader ELF with its constant pools
  // in a separate .rodata section that gets merged into .text in the linker.

  report_fatal_error("Unknown reloc: " + name);
}

// =====================================================================================================================
// Find where an input section contributes to an output section
//
// @param elfInput : ElfInput object for the ELF input
// @param section : Section from that input
// @return : {outputSectionIdx,withinIdx} pair, both elements UINT_MAX if no contribution to an output section
std::pair<unsigned, unsigned> ElfLinkerImpl::findInputSection(ElfInput &elfInput, object::SectionRef section) {
  unsigned idx = section.getIndex();
  if (idx >= elfInput.sectionMap.size())
    return {UINT_MAX, UINT_MAX};
  return elfInput.sectionMap[idx];
}

// =====================================================================================================================
// Read PAL metadata from an ELF file and merge it in to the PAL metadata that we already have
//
// @param objectFile : The ELF input
void ElfLinkerImpl::mergePalMetadataFromElf(object::ObjectFile &objectFile) {
  for (const object::SectionRef &section : objectFile.sections()) {
    object::ELFSectionRef elfSection(section);
    if (elfSection.getType() == ELF::SHT_NOTE) {
      // This is a .note section. Find the PAL metadata note and merge it into the PalMetadata object
      // in the PipelineState.
      Error err = ErrorSuccess();
      auto elfFile = cast<object::ELFObjectFile<object::ELF64LE>>(&objectFile)->getELFFile();
      auto shdr = cantFail(elfFile->getSection(elfSection.getIndex()));
      for (auto note : elfFile->notes(*shdr, err)) {
        if (note.getName() == Util::Abi::AmdGpuArchName && note.getType() == ELF::NT_AMDGPU_METADATA) {
          ArrayRef<uint8_t> desc = note.getDesc();
          m_pipelineState->mergePalMetadataFromBlob(
              StringRef(reinterpret_cast<const char *>(desc.data()), desc.size()));
        }
      }
    }
  }
}

// =====================================================================================================================
// Write the PAL metadata out into the .note section.
void ElfLinkerImpl::writePalMetadata() {
  // Fix up user data registers.
  PalMetadata *palMetadata = m_pipelineState->getPalMetadata();
  palMetadata->fixUpRegisters();
  // Finalize the PAL metadata, writing pipeline state items into it.
  palMetadata->finalizePipeline();
  // Write the MsgPack document into a blob.
  std::string blob;
  palMetadata->getDocument()->writeToBlob(blob);
  // Write the note header.
  StringRef noteName = Util::Abi::AmdGpuArchName;
  typedef object::Elf_Nhdr_Impl<object::ELF64LE> NoteHeader;
  NoteHeader noteHeader;
  noteHeader.n_namesz = noteName.size() + 1;
  noteHeader.n_descsz = blob.size();
  noteHeader.n_type = ELF::NT_AMDGPU_METADATA;
  m_notes.append(reinterpret_cast<const char *>(&noteHeader), sizeof(noteHeader));
  // Write the note name, followed by 1-4 zero bytes to terminate and align.
  m_notes += noteName;
  m_notes.append(NoteHeader::Align - (m_notes.size() & NoteHeader::Align - 1), '\0');
  // Write the blob, followed by 0-3 zero bytes to align.
  m_notes += blob;
  m_notes.append(-m_notes.size() & NoteHeader::Align - 1, '\0');
}

// =====================================================================================================================
// Add an input section to this output section
//
// @param elfInput : ELF input that the section comes from
// @param inputSection : Input section to add to this output section
void OutputSection::addInputSection(ElfInput &elfInput, object::SectionRef inputSection) {
  m_inputSections.push_back(inputSection);
  // Add an entry to the ElfInput's sectionMap, so we can get from an input section to where it contributes
  // to an output section.
  unsigned idx = inputSection.getIndex();
  if (idx >= elfInput.sectionMap.size())
    elfInput.sectionMap.resize(idx + 1, {UINT_MAX, UINT_MAX});
  elfInput.sectionMap[idx] = {getIndex(), m_inputSections.size() - 1};
}

// =====================================================================================================================
// Get the name of this output section
StringRef OutputSection::getName() {
  if (!m_name.empty())
    return m_name;
  if (m_inputSections.empty())
    return "";
  return cantFail(m_inputSections[0].sectionRef.getName());
}

// =====================================================================================================================
// Get the index of this output section
unsigned OutputSection::getIndex() {
  return this - m_linker->getOutputSections().data();
}

// =====================================================================================================================
// Set the layout of this output section, allowing for alignment required by input sections.
// Also copy global symbols for each input section to the output ELF's symbol table.
// This is done as an initial separate step so that in the future we could support a reloc in one output section
// referring to a symbol in a different output section. But we do not currently support that.
void OutputSection::layout() {
  uint64_t size = 0;
  for (InputSection &inputSection : m_inputSections) {
    if (object::ELFSectionRef(inputSection.sectionRef).getFlags() & ELF::SHF_EXECINSTR) {
      // Remove GFX10 s_end_code padding by removing any suffix of the section that is not inside a function symbol.
      inputSection.size = 0;
      for (auto &sym : inputSection.sectionRef.getObject()->symbols()) {
        if (cantFail(sym.getSection()) == inputSection.sectionRef &&
            cantFail(sym.getType()) == object::SymbolRef::ST_Function) {
          inputSection.size =
              std::max(inputSection.size, cantFail(sym.getValue()) + object::ELFSymbolRef(sym).getSize());
        }
      }
      if (inputSection.size == 0) {
        // No function symbols found. We'd better restore the size to the size of the whole section.
        inputSection.size = inputSection.sectionRef.getSize();
      }
    }

    // Gain alignment as required for the next input section.
    uint64_t alignment = getAlignment(inputSection);
    m_alignment = std::max(m_alignment, alignment);
    size = (size + alignment - 1) & -alignment;
    // Store the start offset for the section.
    inputSection.offset = size;
    // Add on the size for this section.
    size += inputSection.size;
  }
  if (m_type == ELF::SHT_NOTE)
    m_alignment = 4;
}

// =====================================================================================================================
// Get alignment for an input section.
//
// @param inputSection : InputSection
uint64_t OutputSection::getAlignment(const InputSection &inputSection) {
  uint64_t alignment = inputSection.sectionRef.getAlignment();
  return alignment;
}

// =====================================================================================================================
// Add a symbol to the output symbol table
//
// @param elfSymRef : The symbol from an input ELF
// @param inputSectIdx : Index of input section within this output section that the symbol refers to
void OutputSection::addSymbol(const object::ELFSymbolRef &elfSymRef, unsigned inputSectIdx) {
  const InputSection &inputSection = m_inputSections[inputSectIdx];
  StringRef name = cantFail(elfSymRef.getName());
  ELF::Elf64_Sym newSym = {};
  newSym.st_name = m_linker->getStringIndex(name);
  newSym.setBinding(elfSymRef.getBinding());
  newSym.setType(cantFail(elfSymRef.getType()));
  newSym.st_shndx = getIndex();
  newSym.st_value = cantFail(elfSymRef.getValue()) + inputSection.offset;
  newSym.st_size = elfSymRef.getSize();
  if (m_linker->findSymbol(newSym.st_name) != 0)
    report_fatal_error("Duplicate symbol '" + name + "'");
  m_linker->getSymbols().push_back(newSym);
}

// =====================================================================================================================
// Write the output section
//
// @param [in/out] outStream : Stream to write the section to
// @param [in/out] shdr : ELF section header to write to (but not sh_offset)
void OutputSection::write(raw_pwrite_stream &outStream, ELF::Elf64_Shdr *shdr) {
  shdr->sh_name = m_linker->getStringIndex(getName());
  m_offset = outStream.tell();

  if (m_type == ELF::SHT_STRTAB) {
    StringRef strings = m_linker->getStrings();
    shdr->sh_type = m_type;
    shdr->sh_size = strings.size();
    m_linker->setStringTableIndex(getIndex());
    outStream << strings;
    return;
  }

  if (m_type == ELF::SHT_SYMTAB) {
    ArrayRef<ELF::Elf64_Sym> symbols = m_linker->getSymbols();
    shdr->sh_type = m_type;
    shdr->sh_size = symbols.size() * sizeof(ELF::Elf64_Sym);
    shdr->sh_entsize = sizeof(ELF::Elf64_Sym);
    shdr->sh_link = 1; // Section index of string table
    outStream << StringRef(reinterpret_cast<const char *>(symbols.data()), symbols.size() * sizeof(ELF::Elf64_Sym));
    return;
  }

  if (m_type == ELF::SHT_NOTE) {
    StringRef notes = m_linker->getNotes();
    shdr->sh_type = m_type;
    shdr->sh_size = notes.size();
    outStream << notes;
    return;
  }

  if (m_inputSections.empty())
    return;

  // This section has contributions from input sections. Get the type and flags from the first input section.
  shdr->sh_type = object::ELFSectionRef(m_inputSections[0].sectionRef).getType();
  shdr->sh_flags = object::ELFSectionRef(m_inputSections[0].sectionRef).getFlags();

  // Set up the pattern we will use for alignment padding.
  const size_t paddingUnit = 16;
  const char *padding = "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";
  const char *endPadding = nullptr;
  if (shdr->sh_flags & ELF::SHF_EXECINSTR) {
    padding = "\0\0\x80\xBF\0\0\x80\xBF\0\0\x80\xBF\0\0\x80\xBF"; // s_nop
    if (m_linker->getPipelineState()->getTargetInfo().getGfxIpVersion().major >= 10)
      endPadding = "\0\0\x9F\xBF\0\0\x9F\xBF\0\0\x9F\xBF\0\0\x9F\xBF"; // s_code_end
  }

  // Output the contributions from the input sections.
  uint64_t size = 0;
  for (InputSection &inputSection : m_inputSections) {
    assert(m_alignment >= getAlignment(inputSection));
    // Gain alignment as required for the next input section.
    uint64_t alignmentGap = -size & (getAlignment(inputSection) - 1);
    while (alignmentGap != 0) {
      size_t thisSize = std::min(alignmentGap, paddingUnit - (size & (paddingUnit - 1)));
      outStream << StringRef(&padding[size & (paddingUnit - 1)], thisSize);
      alignmentGap -= thisSize;
      size += thisSize;
    }

    // Write the input section
    StringRef contents = cantFail(inputSection.sectionRef.getContents());
    outStream << contents.slice(0, inputSection.size);
    size += inputSection.size;
  }

  if (endPadding) {
    // On GFX10 in .text, also add padding at the end of the section: align to 64 bytes, then
    // add another 192 bytes.
    uint64_t alignmentGap = (-size & 0x3F) + 0xC0;
    while (alignmentGap != 0) {
      size_t thisSize = std::min(alignmentGap, paddingUnit - (size & (paddingUnit - 1)));
      outStream << StringRef(&endPadding[size & (paddingUnit - 1)], thisSize);
      alignmentGap -= thisSize;
      size += thisSize;
    }
  }

  shdr->sh_size = size;
  shdr->sh_addralign = m_alignment;
}