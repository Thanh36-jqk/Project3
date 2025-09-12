document.addEventListener('DOMContentLoaded', function() {

    // --- Hero Section Animations ---
    const heroSection = document.getElementById('ipad-hero');
    if (heroSection) {
        setTimeout(() => {
            heroSection.classList.add('loaded');
        }, 100);
    }

    // --- Smooth Scroll for Hero Button ---
    const exploreBtnIpad = document.querySelector('.btn-hero-ipad');
    if(exploreBtnIpad) {
        exploreBtnIpad.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // --- Scroll-Triggered Animations using Intersection Observer ---
    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries, observerInstance) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observerInstance.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });
        animatedElements.forEach(element => {
            observer.observe(element);
        });
    } else {
        animatedElements.forEach(element => {
            element.classList.add('visible');
        });
    }

    // --- Tính năng Popup Đặt Hàng iPad ---
    const productsData = [
      {
        name: "iPad Pro (M4)",
        desc: "Breakthrough M4 Chip, Ultra-thin OLED Tandem Display",
        price: "25,000,000₫",
        img: "../images/ipadprom4.jpg"
      },
      {
        name: "iPad Air (M2)",
        desc: "Powerful M2 chip, thin and light, Apple Pencil Pro",
        price: "15,000,000₫",
        img: "../images/ipad air m2 gold.jpg"
      },
      {
        name: "iPad Gen 10",
        desc: "Thiết kế mới, mạnh mẽ, đa sắc màu",
        price: "9,900,000₫",
        img: "..//images/ipad gen 10.webp"
      },
      {
        name: "iPad mini 6",
        desc: "Nhỏ gọn, chip A15, hỗ trợ Apple Pencil 2",
        price: "11,500,000₫",
        img: "../images/ipadmini6.jpg"
      }
    ];

    // Gắn sự kiện click cho các nút Mua ngay (card bán hàng iPad)
    document.querySelectorAll('.ipad-product-card .btn-buy-ipad').forEach(btn => {
      btn.addEventListener('click', function(e){
        e.preventDefault();
        const name = this.closest('.ipad-product-card').querySelector('h3').textContent.trim();
        openIpadOrderModal(name);
      });
    });

    // Hàm mở popup đặt hàng
    window.openIpadOrderModal = function(productName) {
      const prod = productsData.find(p => p.name === productName);
      if (!prod) return;
      document.getElementById('order-product-img').src = prod.img;
      document.getElementById('order-product-name').textContent = prod.name;
      document.getElementById('order-product-desc').textContent = prod.desc;
      document.getElementById('order-product-price').textContent = prod.price;
      document.getElementById('order-success-msg').style.display = 'none';
      document.getElementById('ipad-order-form').reset();
      document.querySelector('input[name=productName]').value = prod.name;
      document.querySelector('input[name=productPrice]').value = prod.price;
      document.querySelector('input[name=productImage]').value = prod.img;
      document.getElementById('ipad-order-modal').classList.add('active');
    }

    // Hàm đóng popup
    window.closeIpadOrderModal = function() {
      document.getElementById('ipad-order-modal').classList.remove('active');
    }

    // Xử lý gửi đơn hàng lên server API
    document.getElementById('ipad-order-form').
    // Xử lý gửi đơn hàng lên server API
    document.getElementById('ipad-order-form').addEventListener('submit', async function(e){
      e.preventDefault();
      const form = e.target;
      const data = {
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
        const res = await fetch('http://localhost:3000/api/orders', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(data)
        });
        const result = await res.json();
        if (res.ok) {
          form.reset();
          document.getElementById('order-success-msg').textContent = "Đặt hàng thành công! Chúng tôi sẽ liên hệ xác nhận đơn.";
          document.getElementById('order-success-msg').style.display = 'block';
          setTimeout(() => { window.closeIpadOrderModal(); }, 1600);
        } else {
          document.getElementById('order-success-msg').textContent = result.message || "Đặt hàng thất bại!";
          document.getElementById('order-success-msg').style.display = 'block';
        }
      } catch (err) {
        document.getElementById('order-success-msg').textContent = "Lỗi kết nối server!";
        document.getElementById('order-success-msg').style.display = 'block';
      }
    });

}); // <-- Nhớ đóng ngoặc cho event DOMContentLoaded!
