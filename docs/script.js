// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault()
    const target = document.querySelector(this.getAttribute('href'))
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  })
})

// Intersection Observer for animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -80px 0px',
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      setTimeout(() => {
        entry.target.style.opacity = '1'
        entry.target.style.transform = 'translateY(0) translateX(0) scale(1)'
        entry.target.classList.add('visible')
      }, index * 100) // Stagger animation
    }
  })
}, observerOptions)

// Observe feature cards
document.querySelectorAll('.feature-card').forEach((card, index) => {
  card.style.opacity = '0'
  card.style.transform = 'translateY(30px)'
  card.style.transition =
    'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
  observer.observe(card)
})

// Observe stats
document.querySelectorAll('.stat-item').forEach((stat, index) => {
  stat.style.opacity = '0'
  stat.style.transform = 'scale(0.9)'
  stat.style.transition =
    'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
  observer.observe(stat)
})

// Observe code section
const codeWrapper = document.querySelector('.code-wrapper')
if (codeWrapper) {
  codeWrapper.style.opacity = '0'
  codeWrapper.style.transform = 'translateY(30px)'
  codeWrapper.style.transition =
    'opacity 1s cubic-bezier(0.4, 0, 0.2, 1), transform 1s cubic-bezier(0.4, 0, 0.2, 1)'
  observer.observe(codeWrapper)
}

// Add keyboard navigation support
document.querySelectorAll('.btn').forEach((btn) => {
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      btn.click()
    }
  })
})

// Prefers reduced motion check
const prefersReducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches
if (prefersReducedMotion) {
  document.querySelectorAll('[style*="transition"]').forEach((el) => {
    el.style.transition = 'none'
  })
}

// Add scroll progress indicator
const createScrollIndicator = () => {
  const indicator = document.createElement('div')
  indicator.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        background: linear-gradient(90deg, #374151 0%, #1f2937 100%);
        z-index: 9999;
        transition: width 0.1s ease;
    `
  document.body.appendChild(indicator)

  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const scrollHeight =
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight
    const scrollPercentage = (scrollTop / scrollHeight) * 100
    indicator.style.width = scrollPercentage + '%'
  })
}

// Initialize scroll indicator
createScrollIndicator()

// Add copy code functionality
const addCopyButton = () => {
  const codeHeader = document.querySelector('.code-header')
  if (codeHeader) {
    const copyBtn = document.createElement('button')
    copyBtn.innerHTML = '📋 Copy'
    copyBtn.style.cssText = `
            margin-left: auto;
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.25);
            padding: 6px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            transition: all 0.3s ease;
            font-family: 'Monaspace Argon', monospace;
            font-weight: 500;
        `

    copyBtn.addEventListener('mouseover', () => {
      copyBtn.style.background = 'rgba(255, 255, 255, 0.2)'
      copyBtn.style.color = 'rgba(255, 255, 255, 1)'
    })

    copyBtn.addEventListener('mouseout', () => {
      copyBtn.style.background = 'rgba(255, 255, 255, 0.1)'
      copyBtn.style.color = 'rgba(255, 255, 255, 0.7)'
    })

    copyBtn.addEventListener('click', async () => {
      const codeBlock = document.querySelector('.code-block')
      if (codeBlock) {
        try {
          await navigator.clipboard.writeText(codeBlock.textContent)
          copyBtn.innerHTML = '✓ Copied!'
          setTimeout(() => {
            copyBtn.innerHTML = '📋 Copy'
          }, 2000)
        } catch (err) {
          console.error('Failed to copy code:', err)
        }
      }
    })

    codeHeader.appendChild(copyBtn)
  }
}

// Initialize copy button
addCopyButton()
