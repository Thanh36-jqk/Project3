// --- 1. THREE.JS SETUP (High-End 3D Object) ---

const canvas = document.querySelector('#webgl-canvas');
const scene = new THREE.Scene();

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Renderer setup (Trong suốt để thấy nền đen web)
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// --- CREATE OBJECT: "THE CORE" (Đại diện cho Chip/Titanium) ---
// Thay vì load file .glb nặng, ta tạo Geometry phức tạp bằng code
const geometry = new THREE.IcosahedronGeometry(1.8, 1); // Khối đa diện
const material = new THREE.MeshStandardMaterial({
    color: 0x111111,    // Màu đen kim loại
    roughness: 0.3,     // Độ nhám
    metalness: 0.9,     // Độ kim loại cao
    flatShading: true,  // Tạo hiệu ứng các mặt cắt kim cương
    emissive: 0x001133, // Phát sáng nhẹ màu xanh
    emissiveIntensity: 0.2
});

const sphere = new THREE.Mesh(geometry, material);
scene.add(sphere);

// Thêm khung dây (Wireframe) để nhìn "công nghệ" hơn
const wireMat = new THREE.MeshBasicMaterial({ color: 0x0071e3, wireframe: true, transparent: true, opacity: 0.1 });
const wireSphere = new THREE.Mesh(geometry, wireMat);
wireSphere.scale.set(1.05, 1.05, 1.05); // To hơn khối chính một chút
scene.add(wireSphere);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// Đèn xanh dương (Apple Blue) chiếu từ bên phải
const pointLight1 = new THREE.PointLight(0x0071e3, 2, 100);
pointLight1.position.set(5, 5, 5);
scene.add(pointLight1);

// Đèn tím/hồng chiếu từ bên trái (tạo contrast)
const pointLight2 = new THREE.PointLight(0xa855f7, 1, 100);
pointLight2.position.set(-5, -5, 5);
scene.add(pointLight2);

// --- INTERACTION (Mouse Move) ---
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;

const windowHalfX = window.innerWidth / 2;
const windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX);
    mouseY = (event.clientY - windowHalfY);
});

// --- ANIMATION LOOP ---
const clock = new THREE.Clock();

function animate() {
    const elapsedTime = clock.getElapsedTime();

    targetX = mouseX * 0.001;
    targetY = mouseY * 0.001;

    // Xoay khối cầu tự động + theo chuột
    sphere.rotation.y += 0.5 * (targetX - sphere.rotation.y);
    sphere.rotation.x += 0.05 * (targetY - sphere.rotation.x);
    sphere.rotation.z += 0.002; // Tự xoay nhẹ

    // Wireframe xoay ngược chiều tạo hiệu ứng lớp
    wireSphere.rotation.y -= 0.5 * (targetX - wireSphere.rotation.y);
    wireSphere.rotation.x -= 0.05 * (targetY - wireSphere.rotation.x);
    wireSphere.rotation.z -= 0.003;

    // Hiệu ứng "Thở" (Pulse)
    const scale = 1 + Math.sin(elapsedTime * 1.5) * 0.02;
    sphere.scale.set(scale, scale, scale);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}
animate();

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- 2. GSAP ANIMATIONS (Scroll Effects) ---
gsap.registerPlugin(ScrollTrigger);

// Fade-in Hero Text
gsap.from(".fade-in", {
    y: 50,
    opacity: 0,
    duration: 1.5,
    stagger: 0.2,
    ease: "power3.out"
});

// Parallax & Reveal on Scroll
const revealElements = document.querySelectorAll(".gsap-reveal");
revealElements.forEach((el) => {
    gsap.fromTo(el, 
        { y: 50, opacity: 0 },
        {
            y: 0,
            opacity: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
                trigger: el,
                start: "top 85%", // Kích hoạt khi phần tử vào 85% màn hình
                toggleActions: "play none none reverse"
            }
        }
    );
});

// Di chuyển khối 3D khi cuộn (Parallax effect)
gsap.to(sphere.position, {
    y: -2, // Khối cầu trôi xuống khi cuộn
    z: -2, // Khối cầu lùi xa
    scrollTrigger: {
        trigger: "body",
        start: "top top",
        end: "bottom bottom",
        scrub: 2 // Mượt mà
    }
});
