<p align="center">
  <img style="width:128px;height:128px" src="https://gotoeasy.github.io/reall3d/logo.png"/>
</p>

# Reall3dViewer

**Reall3dViewer** is a `Three.js`-based Web renderer for **3D Gaussian Splatting (3DGS)**. It focuses on large‑scene streaming rendering, adaptive LOD, and cross‑platform high‑performance optimization, providing high‑performance Web rendering support for enterprise‑grade 3DGS applications.

<br>

<p align="center">
    <a href="https://zread.ai/reall3d-com/Reall3dViewer"><img src="https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff" alt="Ask Zread" /></a>
    <a href="https://github.com/reall3d-com/Reall3dViewer/blob/master/README_ZH.md"><img src="https://img.shields.io/badge/readme-Chinese-brightgreen.svg"></a>
    <a href="https://github.com/mrdoob/three.js"><img src="https://img.shields.io/badge/base-Threejs-brightgreen.svg"></a>
    <a href="https://github.com/reall3d-com/Reall3dViewer/releases/latest"><img src="https://img.shields.io/github/release/reall3d-com/Reall3dViewer.svg"></a>
    <a href="https://github.com/reall3d-com/Reall3dViewer/blob/master/LICENSE"><img src="https://img.shields.io/github/license/reall3d-com/Reall3dViewer"></a>
<p>
<br>


## 📋 Table of Contents

- [Features](#-features)
- [Benchmarked Performance](#-benchmarked-performance)
- [Live Demos](#-live-demos)
- [Key Configuration Parameters](#%EF%B8%8F-key-configuration-parameters)
- [SPX High‑Compression Format](#-spx-highcompression-format)
- [Quick Start](#%EF%B8%8F-quick-start)
- [Changelog](#-changelog)
- [Acknowledgements](#-acknowledgements)
- [Contact & Support](#-contact--support)

---

## ✨ Features

- ✅ **Multi‑format support**: `.ply`, `.splat`, `.spx`, `.spz`, `.sog`, `.glb` (with `KHR_gaussian_splatting` extension)
- ✅ **Built‑in measurement & annotation**: distance, area, flexible labeling
- ✅ **Spherical harmonics**: supports SH degree 1–3
- ✅ **Map scene rendering**: GIS basemap integration
- ✅ **Per‑model independent configuration**: via `.meta.json` files
- ✅ **Adaptive rendering quality**: multiple quality levels, auto‑optimized per device
- ✅ **Multiple sorting algorithms**: choose optimal strategy for different scenes
- ✅ **Large‑scene streaming**: preset‑based LOD, smooth loading for 100M+ points


## 🚀 Benchmarked Performance

> Tested on a 150‑million‑point scene: Desktop (discrete GPU) **60 FPS**, iGPU laptop **30 FPS**, modern smartphone **25‑40+ FPS**, older smartphone **7‑15+ FPS** – stable, no overheating, no crashes.


## 🌐 Live Demos

- [LOD large scene with debug panel](https://reall3d.com/reall3dviewer/examples/index.html?url=hgd-lod-meta.scene.json&debug=true)
- [Complete indoor exhibition LOD large scene](https://reall3d.com/reall3dviewer/examples/index.html?url=kcczt.scene.json)

> You can also load your own model via URL parameter:  
> `https://reall3d.com/reall3dviewer/examples/index.html?url=your-model.sog&debug=true`


## ⚙️ Key Configuration Parameters

| Parameter | Recommended Default (Mobile/PC) | Description |
|-----------|--------------------------------|-------------|
| `maxRenderCountOfMobile` | 2 million | Max rendered points on mobile, adjustable per device |
| `maxRenderCountOfPc` | 3 million | Max rendered points on PC |
| `qualityLevel` | default 5 (usually) | Quality level (1–9), affects rendering precision & performance |
| `sortType` | default 1 (z-depth) | Sorting algorithm type, choose different strategy per scene |


## 📦 SPX High‑Compression Format

- **Size advantage**: reduces file size by **>95%** compared to PLY, significantly faster loading.
- **Streaming rendering**: native support for LOD tiling and streaming.
- **Conversion tool**: cross‑platform CLI tool `gsbox` (portable, no installation required).

```bash
# Convert PLY to SPX
gsbox ply2spx -i input.ply -o output.spx
```

- [SPX format specification](https://github.com/reall3d-com/Reall3dViewer/blob/main/SPX_ZH.md)
- [gsbox repository](https://github.com/gotoeasy/gsbox)



## 🛠️ Quick Start

Using the source code
```shell
# develop
npm run dev

# build
npm run build

# open a web browser to render your 3dgs model
# http://hostname:port/index.html?url=your-model-link-address

# .sog or .spx file can be obtained through conversion using the gsbox
gsbox ply2sog -i /path/to/input.ply -o /path/to/output.sog
gsbox sog2spx -i /path/to/input.ply -o /path/to/output.spx
```


Using the npm package [example project](https://github.com/reall3d-com/reall3dviewer-samples-use-npm-package)
```shell
# install
npm install @reall3d/reall3dviewer
```

```js
// use built-in viewer
const viewer = new Reall3dViewer({ root: '#gsviewer' });
viewer.addModel(`https://reall3d.com/demo-models/yz.spx`);
```

```js
// preset-lod rendering
const viewer = new Reall3dViewer({ root: '#gsviewer' });
viewer.addScene(`https://reall3d.com/demo-models/lod-v1/hgd/hgd-lod.scene.json`);
```

```js
// use splat mesh
const splatMesh = new SplatMesh({ renderer, scene, controls});
splatMesh.addModel({ url: 'https://reall3d.com/demo-models/yz.spx' });
scene.add(splatMesh);
```

## 📜 Changelog

See [Releases](https://github.com/reall3d-com/Reall3dViewer/releases) for version history.

## 🙏 Acknowledgements

Thanks to the following open‑source projects for reference implementations:

- [antimatter15/splat](https://github.com/antimatter15/splat)
- [mkkellogg/GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D)
- [huggingface/gsplat.js](https://github.com/huggingface/gsplat.js)
- [playcanvas/supersplat](https://github.com/playcanvas/supersplat)
- [sxguojf/three-tile](https://github.com/sxguojf/three-tile)

## 📬 Contact & Support

- **Issues**：Please submit questions and suggestions on the GitHub project page
- **Services**：Model format optimization, IP protection, customization, and other enterprise services
- **Website**：[https://reall3d.com](https://reall3d.com)

