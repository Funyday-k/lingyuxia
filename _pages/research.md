---
layout: archive
title: "Research"
permalink: /research/
author_profile: true
---

## Sub-GeV Dark Matter in the Sun

My current research focuses on **sub-GeV dark matter captured and accumulated in the Sun**. I worked on the numerical framework [**DaMaSCUS-SUN**](https://github.com/temken/DaMaSCUS-SUN), which models dark matter capture, thermalization, evaporation, annihilation, and the resulting signal flux from the Sun.

This project combines solar scattering dynamics with the AGSS09 standard solar model, and it provides a full pipeline for studying how dark matter evolves after entering the solar environment.

My first project based on this framework was [**DaMaSCUS-SUN-EVAP**](https://github.com/Funyday-k/DaMaSCUS-SUN-EVAP), which extends DaMaSCUS-SUN to study dark matter capture and evaporation in the Sun. It uses adaptive RK45 integration to track particle trajectories, determines capture through the bound-state energy condition, and accumulates time-weighted radial and velocity histograms on the fly instead of writing out every trajectory.

The code also records evaporation survival information, supports MPI parallelization across ranks, and includes a safety valve to keep long low-capture runs under control.

## Gravitational Wave Scattering

My undergraduate thesis studied **gravitational wave scattering**. The main challenge was the convergence problem in scattering-amplitude calculations for long-range potentials.

The work built a theoretical framework that goes beyond the usual plane-wave incident assumption by taking into account the long-range effects from both the wave source and the scattering source, with the goal of improving the convergence and consistency of the scattering calculation.

The thesis also developed a corresponding numerical treatment for the scattering problem and connected it to partial-wave analysis in the long-range regime.

![Trajectory Validation](/lingyuxia/images/trajectory_validation.png)
