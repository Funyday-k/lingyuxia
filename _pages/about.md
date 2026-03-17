---
permalink: /
title: "About me?"
excerpt: "About me"
author_profile: true
redirect_from: 
  - /about/
  - /about.html
---

Hi! 

My name is **Lingyu Xia(夏凌羽)**, and I am currently a PhD student in the Department of Physics at The Chinese University of Hong Kong. My advisor is [Prof. Kenny Ng.](https://wp.phy.cuhk.edu.hk/teaching_staff/kenny-c-y-ng) My research interests are: **Dark Matter, Cosmic Ray**. 

# Education 

- 2021.09--2025.06, B.S. in Physics, Taishan College, Shandong University,  supervised by [Prof. Hong Zhang(张宏)](http://www.pppi.sdu.edu.cn/info/1059/2453.htm).
- 2023.12--2024.08, Exchange Student, The Department of Physics, Bar-Ilan University, supervised by [Prof. Asaf Peer](https://physics.biu.ac.il/en/node/4374).
- 2025.08--Present, PhD student, The Department of Physics, The Chinese University of Hong Kong, supervised by [Prof. Kenny Chun Yu Ng (吳震宇)](https://wp.phy.cuhk.edu.hk/teaching_staff/kenny-c-y-ng)
  


# Conferences & Visiting

- 2026.8.31 - 9.4: [TeV Particle Astrophysics 2026](https://indico-icehap.phys.s.chiba-u.ac.jp/event/3/page/15-overview-of-tevpa-2026) (Tendo, Japan, **Planning**)
- 2025.11.3 :[The First HKIAA Symposium](https://www.scifac.hku.hk/news/hku-launches-the-hong-kong-institute-for-astronomy-and-astrophysics) (HKU, Hong Kong)
- 2025.10.25 - 10.26: [2025 Future Science Prize Week Science Symposium II](https://www.futureprize-hk.org/en/2025sciencesymposium-ii) (Hong Kong)
- 2025.3.21 - 3.24: [The 2nd LHAASO Symposium](https://indico.ihep.ac.cn/event/23146/).(CUHK, Hong Kong)
- 2024.4.11: [The 69th annual conference of the Israel Physical Society](https://www.israelphysicalsociety.org/conference/69th-annual-meeting). (Tel Aviv University, Israel)





# Research

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

# Publication


![alt text](/lingyuxia/images/pub_note.jpg)


# Useful Links
- [MAURICIO's Daily ArXiv Picks](https://mbustamante.net/my-daily-arxiv-picks/)
- [Inspire HEP](https://inspirehep.net/)
- [NASA ADS](https://ui.adsabs.harvard.edu/)
-  [CUHK Physics Department](https://phy.cuhk.edu.hk/)
-  [Institute of Frontier and Interdisciplinary Sciences, SDU](https://frontier.qd.sdu.edu.cn)

# My Contact details

> **Name: Lingyu Xia 夏凌羽**
> 
> **Address：Room 313, Science Centre North Block,Department of Physics, Faculty of Science, The Chinese University of Hong Kong, Hong Kong, China**
> 
> **E-mail: lingyuxia@link.cuhk.edu.hk & xialingyu213@gmail.com**
>
> **Phone Number: Guess!**


> **Update: 2026.03.17**


