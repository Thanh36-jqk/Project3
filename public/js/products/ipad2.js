document.addEventListener('DOMContentLoaded', function () {

  // ==================== TAB NAVIGATION SYSTEM ====================
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabIndicator = document.querySelector('.tab-indicator');
  let isScrolling = false;

  // Initialize tab indicator position
  function updateTabIndicator(activeTab) {
    const tabRect = activeTab.getBoundingClientRect();
    const navRect = activeTab.parentElement.getBoundingClientRect();
    const offsetLeft = activeTab.offsetLeft;
    const width = tabRect.width;

    tabIndicator.style.width = `${width}px`;
    tabIndicator.style.transform = `translateX(${offsetLeft}px)`;
  }

  // Set initial indicator position
  const activeTab = document.querySelector('.tab-link.active');
  if (activeTab) {
    updateTabIndicator(activeTab);
  }

  // Tab click handler
  tabLinks.forEach(tab => {
    tab.addEventListener('click', function (e) {
      e.preventDefault();

      // Remove active class from all tabs
      tabLinks.forEach(t => t.classList.remove('active', 'text-white'));
      tabLinks.forEach(t => {
        if (!t.classList.contains('active')) {
          t.classList.add('text-gray-400');
        }
      });

      // Add active class to clicked tab
      this.classList.add('active', 'text-white');
      this.classList.remove('text-gray-400');

      // Update indicator
      updateTabIndicator(this);

      // Smooth scroll to section
      const sectionId = this.getAttribute('data-section');
      const section = document.getElementById(sectionId);

      if (section) {
        isScrolling = true;
        const offset = 120; // Account for fixed header + tab nav
        const sectionTop = section.offsetTop - offset;

        window.scrollTo({
          top: sectionTop,
          behavior: 'smooth'
        });

        // Re-enable scroll tracking after animation
        setTimeout(() => {
          isScrolling = false;
        }, 1000);
      }
    });
  });

  // Active tab tracking on scroll
  const sections = document.querySelectorAll('section[id]');

  function highlightActiveTab() {
    if (isScrolling) return;

    const scrollY = window.scrollY + 150;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        const correspondingTab = document.querySelector(`.tab-link[data-section="${sectionId}"]`);

        if (correspondingTab && !correspondingTab.classList.contains('active')) {
          tabLinks.forEach(t => {
            t.classList.remove('active', 'text-white');
            t.classList.add('text-gray-400');
          });

          correspondingTab.classList.add('active', 'text-white');
          correspondingTab.classList.remove('text-gray-400');
          updateTabIndicator(correspondingTab);
        }
      }
    });
  }

  // Throttle scroll event for performance
  let scrollTimeout;
  window.addEventListener('scroll', function () {
    if (scrollTimeout) {
      window.cancelAnimationFrame(scrollTimeout);
    }
    scrollTimeout = window.requestAnimationFrame(function () {
      highlightActiveTab();
    });
  });

  // ==================== SCROLL REVEAL ANIMATIONS ====================
  const revealElements = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  });

  revealElements.forEach(element => {
    revealObserver.observe(element);
  });

  // ==================== PRODUCT ORDER MODAL ====================
  const productsData = [
    {
      name: "iPad Pro",
      desc: "The ultimate iPad experience with M4 chip and Ultra Retina XDR display.",
      price: "25,000,000₫",
      img: "../images/ipad pro m4/ipad pro m4 black.png"
    },
    {
      name: "iPad Air",
      desc: "Serious performance in a thin and light design with M2 chip.",
      price: "15,000,000₫",
      img: "../images/ipad air m2/ipad air m2 gold.png"
    },
    {
      name: "iPad",
      desc: "The colorful, all-screen iPad for the things you do every day.",
      price: "9,900,000₫",
      img: "../images/ipad (10th gen)/ipad gen 10 yellow.webp"
    },
    {
      name: "iPad mini",
      desc: "The full iPad experience designed to fit in one hand.",
      price: "11,500,000₫",
      img: "../images/ipad mini 6/ipad mini 6 purple.png"
    }
  ];

  // Attach click events to Buy buttons
  document.querySelectorAll('.ipad-product-card .btn-buy-ipad').forEach(btn => {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      const productName = this.closest('.ipad-product-card').querySelector('h3').textContent.trim();
      handleBuyNow(productName);
    });
  });

  // Open checkout function
  window.handleBuyNow = function (productName) {
    const product = productsData.find(p => p.name === productName);
    if (!product) return;

    const priceNum = Number(product.price.replace(/[^\d]/g, ''));

    const buyNowItem = {
      productId: product.name,
      name: product.name,
      price: priceNum,
      image: product.img,
      category: 'iPad',
      quantity: 1,
      color: null
    };

    localStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));
    window.location.href = '../../checkout.html';
  };

  // ==================== TOUCH OPTIMIZATIONS ====================

  // Prevent double-tap zoom on buttons
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, false);

  // Add active state to touch interactions
  const touchElements = document.querySelectorAll('button, a, .tilt-card');
  touchElements.forEach(element => {
    element.addEventListener('touchstart', function () {
      this.style.opacity = '0.8';
    });

    element.addEventListener('touchend', function () {
      this.style.opacity = '';
    });
  });

  // ==================== CART COUNT (if needed) ====================
  // You can integrate with your cart system here
  function updateCartCount() {
    // Example: get from localStorage or API
    const cartCount = localStorage.getItem('cartCount') || 0;
    const cartBadge = document.querySelector('.cart-count');
    if (cartBadge) {
      cartBadge.textContent = cartCount;
    }
  }

  updateCartCount();

  // ==================== PERFORMANCE OPTIMIZATIONS ====================

  // Lazy load images when near viewport
  const lazyImages = document.querySelectorAll('img[data-src]');
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
        imageObserver.unobserve(img);
      }
    });
  });

  lazyImages.forEach(img => imageObserver.observe(img));

  // Log initialization
  console.log('✓ iPad interface initialized with premium interactions');
  console.log('✓ Tab navigation active');
  console.log('✓ Scroll animations ready');
  console.log('✓ Touch optimizations enabled');

});
