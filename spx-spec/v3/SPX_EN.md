## SPX Version 3 Format Specification
The `.spx` format is a 3DGS model format designed to be fle**X**ible, e**X**tensible, and e**X**clusive.


<br>


- [x] `Flexible` Optimized file header structure, flexible data blocks, and effective compression
- [x] `Extensible` Open format with reserved fields for future expansion
- [x] `Exclusive` Custom format identifiers for proprietary data protection



## File Header (128 bytes)
Fixed-length header for format identification, containing bounding box data for sorting optimization and custom identifiers.

| Byte Offset | Type      | Field Name            | Description                                                                 |
|-------------|-----------|-----------------------|-----------------------------------------------------------------------------|
| 0–2         | ASCII     | `*`Magic           | Fixed value `spx`                                                         |
| 3           | uint8     | `*`Version               | Current version: `3`                                                        |
| 4–7         | uint32    | `*`Gaussian Count        | Total number of Gaussian points                                             |
| 8–11        | float32   | `*`MinX                  | Bounding box minimum X coordinate                                           |
| 12–15       | float32   | `*`MaxX                  | Bounding box maximum X coordinate                                           |
| 16–19       | float32   | `*`MinY                  | Bounding box minimum Y coordinate                                           |
| 20–23       | float32   | `*`MaxY                  | Bounding box maximum Y coordinate                                           |
| 24–27       | float32   | `*`MinZ                  | Bounding box minimum Z coordinate                                           |
| 28–31       | float32   | `*`MaxZ                  | Bounding box maximum Z coordinate                                           |
| 32–35       | float32   | Min Center Height        | Min model center height (Y-axis)                                                |
| 36–39       | float32   | Max Center Height        | Max model center height (Y-axis)                                                |
| 40–43       | uint32    | Creation Date         | Date in `YYYYMMDD` format                                                   |
| 44–47       | uint32    | `*`Creater ID         | A unique value (other than `0` reserved for official use) to identify the creater  |
| 48–51       | uint32    | `*`Exclusive ID       | A non-zero value (where `0` indicates public formats) defines a proprietary/private data block format      |
| 52          | uint8     | SH degree             | Allowed values: `0,1,2,3`. Others → `0` |
| 53          | uint8     | Bit Flags             | Represent different flags by bit, details as follows |
|             |     bit 0 | Flag 1: Inverted      | Default not inverted `0` |
|             |     bit 1 | Flag 2: Reserved      | Reserved |
|             |     bit 2 | Flag 3: Reserved      | Reserved |
|             |     bit 3 | Flag 4: Reserved      | Reserved |
|             |     bit 4 | Flag 5: Reserved      | Reserved |
|             |     bit 5 | Flag 6: Reserved      | Reserved |
|             |     bit 6 | Flag 7: Reserved      | Reserved |
|             |     bit 7 | Flag 8: Large Scene   | Default small scene `0` |
| 54          | uint8     | Reserved              | Reserved                         |
| 55          | uint8     | Reserved              | Reserved                                 |
| 56–63       | -         | Reserved              | Reserved                                        |
| 64–123      | ASCII     | Comment               | Maximum 60 ASCII characters                    |
| 124–127     | uint32    | `*`Checksum           | Validates file integrity (creater-specific)                               |

---

## Data Blocks
Data blocks consist of a fixed header followed by customizable content.

### Data Block Structure
| Byte Offset | Type      | Field Name            | Description                                                                 |
|-------------|-----------|-----------------------|-----------------------------------------------------------------------------|
| 0~3         | uint32       | * Data Block Definition | Compression Flag (1bit) + Compression Type (3bit) + Data Block Length (28bit) |
|             |   bit0       | * Compression Flag      | 1 bit indicating whether the data content is compressed (0: uncompressed, 1: compressed) |
|             |   bit1~bit3  | * Compression Type      | 3 bits indicating the compression type of the data content (0: gzip, 1: xz) |
|             |   bit4~bit31 | * Data Block Length     | 28 bits indicating the length of the content in this data block |
| 0–n         | bytes     | `*`Block Content      | Actual data (format defined below)                                          |



### Data Block Content
| Byte Offset | Type      | Field Name            | Description                                                                 |
|-------------|-----------|-----------------------|-----------------------------------------------------------------------------|
| 0–3         | uint32    | `*`Count              | Number of Gaussians in this block                                           |
| 4–7         | uint32    | `*`Format ID          | Identifies block format                                                     |
| 8–n         | bytes     | `*`Data               | Structured per Format ID                                                    |

---

## Open Block Content Formats

he data block format encompasses both open and exclusive formats. The reserved range from `0 to 65535` is designated for defining the open format, while other values are employed for exclusive formats.

<br>


✅  Open Format `22`, basic data (for use when more focus on encoding/decoding performance)


| Byte Offset | Type      | Field Name            | Description                                                                 |
|-------------|-----------|-----------------------|-----------------------------------------------------------------------------|
| 0~3 | uint32 | `*`Gaussian Count | Number of Gaussians |
| 4~7 | uint32 | `*`Format ID | `22` |
| 8~n | bytes | `*`Data | x0...y0...z0...x1...y1...z1...x2...y2...z2...sx...sy...sz...r...g...b...a...rw...rx...ry...rz...p0...p1... |

- `x,y,z` Coordinates, 24-bit precision (`x`, `y`, `z`).
- `sx,sy,sz` Scale, 8-bit per axis (`sx`, `sy`, `sz`).
- `r,g,b,a` Color, RGBA channels (8-bit each).
- `rw,rx,ry,rz` Rotation, Quaternion components (8-bit each).
- `p0,p1` Low and high bytes of palette index; omitted when no palette is used.

---



✅  Open Format `23`, basic data (for large-scale scenes where more focus is on encoding/decoding performance)


Same as format `22`, but `x,y,z` coordinates are not Log-encoded, resulting in smaller errors.




✅  Open Format `220`, basic data (for use when more focus on compression ratio)


| Byte Offset | Type      | Field Name            | Description                                                                 |
|-------------|-----------|-----------------------|-----------------------------------------------------------------------------|
| 0~3 | uint32 | `*`Gaussian Count | Number of Gaussians |
| 4~7 | uint32 | `*`Format ID | `220`, webp encoding |
| 8~n | bytes | `*`Data | length,webp([x0,y0,z0,255...]), length,webp([x1,y1,z1,255...]), length,webp([x2,y2,z2,255...]), length,webp([sx,sy,sz,255...]), length,webp([r,g,b,a...]), length,webp([r0,r1,r2,ri...], length,webp([p0,p1,0,255...]) |

- `x,y,z` Coordinates, 24-bit precision.
- `sx,sy,sz` Scale, 8-bit per axis.
- `r,g,b,a` Color, RGBA channels (8-bit each).
- `r0,r1,r2,ri` Rotation, Quaternion components (8-bit each), ri is the index of the maximum value + 252.
- `p0,p1` Low and high bytes of palette index; omitted when no palette is used.

---



✅  Open Format `230`, basic data (for use when more focus on compression ratio)


Same as format `220`, but `x,y,z` coordinates are not Log-encoded, resulting in smaller errors.



✅  Open Format `8`, palettes of SH (auto-selected by strategy, no manual specification required)


| Byte Offset | Type      | Field Name            | Description                                                                 |
|----------|------|------|------|
| 0–3      | uint32 |      |  Reserved                                                        |
| 4–7      | uint32 | `*`Format ID          | `8` palettes of Spherical harmonics (SH) degree 1~3                       |
| 8~n      | bytes  | `*`Data               | [sh0,sh1,sh2...sh14,sh0,sh1,sh2...sh14,...]                |

- `sh0,sh1,sh2...sh14` Spherical harmonic coefficients (r,g,b,255), in pixel units

---



✅  Open Format `9`, palettes of SH , webp encoding (auto-selected by strategy, no manual specification required)


| Byte Offset | Type      | Field Name            | Description                                                                 |
|----------|------|------|------|
| 0–3      | uint32 |      |  Reserved                                                        |
| 4–7      | uint32 | `*`Format ID          | `9` palettes of Spherical harmonics (SH) degree 1~3                       |
| 8~n      | bytes  | `*`Data               | webp([sh0,sh1,sh2...sh14,sh0,sh1,sh2...sh14,...])                |

- `sh0,sh1,sh2...sh14` Spherical harmonic coefficients (r,g,b,255), in pixel units

---


## Historical Version

- `SPX SPEC V2` https://github.com/reall3d-com/Reall3dViewer/blob/main/spx-spec/v2/SPX_EN.md
- `SPX SPEC V1` https://github.com/reall3d-com/Reall3dViewer/blob/main/spx-spec/v1/SPX_EN.md
