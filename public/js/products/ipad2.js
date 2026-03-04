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
      openIpadOrderModal(productName);
    });
  });

  // Open modal function
  window.openIpadOrderModal = function (productName) {
    if (!localStorage.getItem('accessToken')) {
      alert('Please log in to purchase');
      window.location.href = '../../pages/auth/login.html';
      return;
    }
    const product = productsData.find(p => p.name === productName);
    if (!product) return;

    // Populate modal with product info
    document.getElementById('order-product-img').src = product.img;
    document.getElementById('order-product-name').textContent = product.name;
    document.getElementById('order-product-desc').textContent = product.desc;
    document.getElementById('order-product-price').textContent = product.price;

    // Set hidden inputs
    document.querySelector('input[name=productName]').value = product.name;
    document.querySelector('input[name=productPrice]').value = product.price;
    document.querySelector('input[name=productImage]').value = product.img;

    // Reset form and messages
    document.getElementById('ipad-order-form').reset();
    document.getElementById('order-success-msg').classList.add('hidden');

    // Show modal
    document.getElementById('ipad-order-modal').classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  };

  // Close modal function
  window.closeIpadOrderModal = function () {
    document.getElementById('ipad-order-modal').classList.remove('active');
    document.body.style.overflow = ''; // Restore scroll
  };

  // Close modal on background click
  document.getElementById('ipad-order-modal').addEventListener('click', function (e) {
    if (e.target === this) {
      closeIpadOrderModal();
    }
  });

  // Close modal on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeIpadOrderModal();
    }
  });

  // Handle form submission
  document.getElementById('ipad-order-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton.textContent;

    // Show loading state
    submitButton.textContent = 'Processing...';
    submitButton.disabled = true;

    const orderData = {
      recipientName: form.recipientName.value,
      recipientPhone: form.recipientPhone.value,
      recipientAddress: form.recipientAddress.value,
      recipientNotes: form.recipientNotes.value,
      paymentMethod: form.paymentMethod.value,
      items: [{
        name: form.productName.value,
        price: form.productPrice.value,
        qty: 1,
        image: form.productImage.value
      }],
      totalAmountString: form.productPrice.value,
      totalAmountNumeric: Number(form.productPrice.value.replace(/[^\d]/g, ''))
    };

    try {
      const response = await fetch('https://project3-icy1.onrender.com/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      if (response.ok) {
        // Success
        document.getElementById('order-success-msg').textContent = '✓ Order placed successfully! We will contact you soon.';
        document.getElementById('order-success-msg').classList.remove('hidden');
        document.getElementById('order-success-msg').classList.remove('bg-red-100', 'text-red-800');
        document.getElementById('order-success-msg').classList.add('bg-green-100', 'text-green-800');

        form.reset();

        // Close modal after delay
        setTimeout(() => {
          closeIpadOrderModal();
        }, 2000);
      } else {
        // Error from server
        document.getElementById('order-success-msg').textContent = result.message || 'Failed to place order. Please try again.';
        document.getElementById('order-success-msg').classList.remove('hidden');
        document.getElementById('order-success-msg').classList.remove('bg-green-100', 'text-green-800');
        document.getElementById('order-success-msg').classList.add('bg-red-100', 'text-red-800');
      }
    } catch (error) {
      // Network error
      document.getElementById('order-success-msg').textContent = 'Network error. Please check your connection and try again.';
      document.getElementById('order-success-msg').classList.remove('hidden');
      document.getElementById('order-success-msg').classList.remove('bg-green-100', 'text-green-800');
      document.getElementById('order-success-msg').classList.add('bg-red-100', 'text-red-800');
    } finally {
      // Restore button state
      submitButton.textContent = originalButtonText;
      submitButton.disabled = false;
    }
  });

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
