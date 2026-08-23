/**
 * MATIX Standalone Marketing Landing Page Script
 * Pure Vanilla JS — Zero dependencies, ultra fast.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobile-menu-btn');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  const mobileDrawer = document.getElementById('mobile-nav-drawer');
  const mobileOverlay = document.getElementById('mobile-nav-overlay');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-links .nav-link');

  function openDrawer() {
    mobileOverlay.classList.add('active');
    mobileDrawer.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    mobileOverlay.classList.remove('active');
    mobileDrawer.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (mobileToggle) mobileToggle.addEventListener('click', openDrawer);
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', closeDrawer);
  if (mobileOverlay) mobileOverlay.addEventListener('click', closeDrawer);

  mobileNavLinks.forEach(link => {
    link.addEventListener('click', closeDrawer);
  });

  // 2. Smooth Scroll Anchor Links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || !targetId) return;
      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        const headerOffset = 80;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // 3. Header Shadow on Scroll
  const siteHeader = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      siteHeader.style.boxShadow = '0 4px 20px -2px rgba(0, 0, 0, 0.08)';
    } else {
      siteHeader.style.boxShadow = 'none';
    }
  });

  // 4. Contact & Demo Request Form Handling
  const contactForm = document.getElementById('inquiry-form');
  const formAlert = document.getElementById('form-alert');
  const whatsappDirectBtn = document.getElementById('btn-whatsapp-direct');

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const fullName = document.getElementById('input-name').value.trim();
      const company = document.getElementById('input-company').value.trim();
      const phone = document.getElementById('input-phone').value.trim();
      const email = document.getElementById('input-email').value.trim();
      const projects = document.getElementById('input-projects').value;
      const message = document.getElementById('input-message').value.trim();

      if (!fullName || !phone) {
        alert('يرجى ملء الاسم ورقم الهاتف على الأقل للتواصل معك.');
        return;
      }

      // Show Success Message
      if (formAlert) {
        formAlert.className = 'form-alert-box success';
        formAlert.innerHTML = `
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <div>
            <strong>شكراً لك ${fullName}!</strong> تم استلام طلبك بنجاح. سيتواصل معك أحد مستشارينا الميدانيين خلال 24 ساعة لترتيب العرض التوضيحي.
          </div>
        `;
        formAlert.style.display = 'flex';
      }

      // Reset form
      contactForm.reset();

      // Scroll to alert
      formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  // 5. Direct WhatsApp formatting with prefilled message
  if (whatsappDirectBtn) {
    whatsappDirectBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const phoneNum = '213555000000'; // Default business contact number
      const defaultText = encodeURIComponent('مرحباً فريق ماتيكس، أرغب في معرفة المزيد عن منصة تتبع المشاريع والمستودعات MATIX وطلب عرض تجريبي لمؤسستنا.');
      window.open(`https://wa.me/${phoneNum}?text=${defaultText}`, '_blank');
    });
  }
});
