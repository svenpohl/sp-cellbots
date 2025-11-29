[⬅️ Back to Research-Notes Overview](../research.md)

## GPU vs. CPU Pathfinding in NxNxN Grids with Obstacles  
2025-11-29


## Summary of Initial Observations (GPU vs. CPU Pathfinding Benchmark)

On a **MacBook Pro (Intel Core i9-9880H, Radeon Pro 5500M with 4 GB GDDR6)**, a small benchmark tool was used to compute **N paths** inside a **3D grid (size 10–200)**.

Two methods were compared:

- **CPU:** classical **BFS (Breadth-First Search)**
- **GPU:** simplified **relaxation-based distance propagation** (parallel distance relaxation)

Each test computed a path from a random coordinate on one wall of the cube to a random coordinate on the opposite wall, with a **small internal obstacle** present.  
All measurements were repeated multiple times.

### Measured Timings

| GridSize | CPU BFS                | GPU Relax              | Ratio                    |
|----------|------------------------|------------------------|--------------------------|
| 10       | ~3 ms                  | ~60 ms                 | CPU ~20× faster          |
| 20       | ~4 ms                  | ~60 ms                 | CPU ~15× faster          |
| 30       | ~64 ms                 | ~80–100 ms             | roughly equal            |
| 50       | ~140 ms                | ~75 ms                 | GPU ~2× faster           |
| 100      | ~1000 ms               | ~140 ms                | GPU ~7× faster           |
| 150      | ~43,000 ms             | ~400 ms                | GPU ~107× faster         |
| 200      | >60,000 ms (aborted)   | —                      | —                        |

### First Conclusions

The CPU is significantly faster for **small to medium grids (≤30³)**.  
Around **50³**, the performance trend begins to reverse.  
At **100³ and above**, the GPU becomes overwhelmingly superior, as parallelism dominates and BFS scaling collapses.

### Additional Observations

The **initialization of the GPU kernel** introduces a noticeable overhead.  
For small grids (e.g., 10³ or 20³), this one-time initialization cost outweighs the GPU’s parallel advantages, making the GPU much slower.

Starting at a **grid size of roughly 30³**, the GPU becomes efficient despite the initialization overhead.  
From **100³** upward, GPU acceleration is essentially **mandatory** if path planning (e.g., BFS or distance field generation) is used for morphing instead of fully emergent methods (e.g., Floodfill / Gradient-Flow).

Another practical finding:

- GPU shader support in **nodejs v23.11.0** is **poor or unstable**.
- The tests had to be run using an older but more reliable version of **Deno (deno 1.45.4)**, where GPU compute (WGPU/WebGPU) behaved significantly better.
