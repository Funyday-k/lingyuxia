---
layout: archive
title: "Research"
permalink: /research/
author_profile: true
---

## Sub-GeV Dark Matter in the Sun

My current research focuses on **sub-GeV dark matter (DM) captured and accumulated in the Sun**. When galactic dark matter particles enter the Sun, they undergo elastic scattering with solar nuclei (primarily hydrogen), lose kinetic energy, and become gravitationally bound. Over time, processes of **capture, evaporation, and annihilation** reach equilibrium, and the resulting annihilation products — such as neutrinos and gamma rays — may be detected by experiments like Super-Kamiokande and Fermi-LAT.

Based on the theoretical framework of [Garani & Palomares-Ruiz (2017)](https://arxiv.org/abs/1702.02768) and the AGSS09 standard solar model, I developed a complete numerical computation pipeline ([**DaMaSCUS-SUN**](https://github.com/temken/DaMaSCUS-SUN)) covering:

- DM spatial distribution in both the **Knudsen limit** (isothermal) and **LTE limit** (local thermal equilibrium with thermal diffusion), with a Knudsen-number-based interpolation for intermediate regimes
- **Evaporation rate** calculation including optical depth suppression and angular/multiple-scattering corrections
- **Annihilation signal flux** at Earth, compared against current experimental constraints

## Accelerating DM Simulation with Diffusion Models

To overcome the computational bottleneck of traditional Monte Carlo trajectory sampling, I am developing [**DaMaSCUS-Diffusion**](https://github.com/Funyday-k/DaMaSCUS--Diffusion) — a machine learning approach that uses a **FiLM-conditioned score-based diffusion model (VP-SDE)** to replace MC scattering sampling:

- The model learns the conditional distribution of post-scattering states $(r, v_\text{rad}, v_\text{tan}, E)$ given pre-scattering conditions, exploiting solar spherical symmetry
- Trained on ~5.2M scattering events extracted from DaMaSCUS-SUN MC simulations
- Achieves **< 3% normalized Wasserstein error** across all physical dimensions while providing **~1000× speedup** (milliseconds vs. seconds per trajectory)
- Gravitational orbit propagation is still handled by exact RK45 integration — only the stochastic scattering step is replaced by the learned sampler

![Trajectory Validation](/lingyuxia/images/trajectory_validation.png)
