#pragma once

#include <array>
#include <cstddef>

namespace aetherwave::dsp
{
class WavetableBank
{
public:
    static constexpr std::size_t tableSize = 256;
    static constexpr std::size_t numSlices = 16;
    static constexpr std::size_t numTables = 6;

    using Slice = std::array<float, tableSize>;
    using Table = std::array<Slice, numSlices>;

    WavetableBank();

    float sample(int tableIndex, float position, double phase) const noexcept;

private:
    std::array<Table, numTables> tables {};

    void generate();
    static void normalise(Slice& slice) noexcept;
};
}
