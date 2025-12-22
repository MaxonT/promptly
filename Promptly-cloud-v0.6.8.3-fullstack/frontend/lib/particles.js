(function() {
  function createParticles() {
    // Check if container already exists to avoid duplicates
    if (document.querySelector('.particles-container')) return;

    const container = document.createElement('div');
    container.className = 'particles-container';
    container.setAttribute('aria-hidden', 'true');
    
    // Insert as the first child of body to stay behind content
    document.body.prepend(container);

    const particleCount = 24; // Balanced count

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      
      // Random properties for natural feel
      const size = Math.random() * 3 + 2; // 2px - 5px
      const posX = Math.random() * 100; // 0% - 100%
      const posY = Math.random() * 100; // 0% - 100%
      const duration = Math.random() * 20 + 15; // 15s - 35s
      const delay = Math.random() * -30; // Negative delay to start mid-animation

      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${posX}%`;
      particle.style.top = `${posY}%`;
      particle.style.animationDuration = `${duration}s`;
      particle.style.animationDelay = `${delay}s`;

      container.appendChild(particle);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createParticles);
  } else {
    createParticles();
  }
})();
