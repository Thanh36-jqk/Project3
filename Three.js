const activeModels = {
    iphone1Model: null,
    iphone2Model: null
};

function loadModel(elementId, modelUrl) {
    const container = document.getElementById(elementId);
    if (!container) {
        console.error(`Không tìm thấy container với ID: ${elementId}`);
        return;
    }

    // Dọn dẹp model cũ, renderer, và controls cũ nếu có
    if (activeModels[elementId]) {
        if (activeModels[elementId].controls) {
            activeModels[elementId].controls.dispose(); // Dọn dẹp controls cũ
        }
        if (activeModels[elementId].renderer) {
            activeModels[elementId].renderer.dispose(); // Giải phóng tài nguyên renderer
        }
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }
        activeModels[elementId] = null;
    }

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f7f7); // Màu nền giống khu vực ảnh accordion

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0.1, 0.7); // Tăng giá trị Z một chút để camera lùi ra xa hơn, dễ quan sát model hơn với OrbitControls

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    if (!THREE || !THREE.OrbitControls) {
        console.error("THREE.OrbitControls is not available! Hãy kiểm tra thẻ script trong HTML.");
        container.innerHTML = `<p style="color:red; text-align:center; padding-top: 20px;">Lỗi thư viện điều khiển 3D (OrbitControls).</p>`;
        return;
    }
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Cho phép hiệu ứng "trôi" mượt mà
    controls.dampingFactor = 0.05; // Hệ số trôi
    // controls.minDistance = 0.3; // Khoảng cách zoom vào gần nhất (điều chỉnh nếu cần)
    // controls.maxDistance = 1.0;   // Khoảng cách zoom ra xa nhất (điều chỉnh nếu cần)
    // controls.target.set(0, -0.05, 0); // Nếu model.position.y = -0.05, đặt target tương ứng
    // controls.autoRotate = false; // Tắt tự động xoay của OrbitControls (nếu có)

    // 5. Ánh sáng
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9); // Tăng cường độ ánh sáng môi trường một chút
    scene.add(ambientLight);
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8); // Ánh sáng hướng chính
    directionalLight1.position.set(5, 10, 7.5);
    scene.add(directionalLight1);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5); // Thêm một ánh sáng hướng phụ từ hướng khác
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);


    // 6. GLTFLoader
    if (!THREE || !THREE.GLTFLoader) {
        console.error("THREE.GLTFLoader is not available!");
        container.innerHTML = `<p style="color:red; text-align:center; padding-top: 20px;">Lỗi thư viện 3D (GLTFLoader).</p>`;
        return;
    }
    const modelLoader = new THREE.GLTFLoader(); // Đổi tên biến để tránh nhầm lẫn với biến `loader` nếu có ở phạm vi khác
    modelLoader.load(modelUrl, function (gltf) {
        const model = gltf.scene;
        
        // Tính toán kích thước và vị trí trung tâm của model để đặt camera và controls hợp lý
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        
        // Điều chỉnh khoảng cách camera dựa trên kích thước model, thêm một chút padding
        cameraZ *= 1.5; // Tăng khoảng cách để nhìn rõ hơn
        camera.position.z = center.z + cameraZ;
        camera.position.x = center.x;
        camera.position.y = center.y;
        
        controls.target.copy(center); // Đặt target của controls vào trung tâm model
        
        // Tỷ lệ model (có thể cần điều chỉnh tùy theo model cụ thể)
        // Nếu model quá lớn hoặc quá nhỏ, bạn có thể cần scale lại
        // model.scale.set(0.1, 0.1, 0.1); // Dòng này có thể không cần nếu camera đã được điều chỉnh
        model.position.y = -0.05; // Giữ lại nếu bạn muốn model dịch xuống một chút so với tâm

        scene.add(model);

        // Lưu trữ model, renderer, scene, camera và controls
        activeModels[elementId] = { model, renderer, scene, camera, controls };

        // Vòng lặp render (animation loop)
        function animate() {
            requestAnimationFrame(animate);
            controls.update(); // Cập nhật OrbitControls (quan trọng nếu enableDamping = true)
            
            // Dòng xoay tự động đã bị loại bỏ
            // if (model) model.rotation.y += 0.005; 
            
            renderer.render(scene, camera);
        }
        animate();

    }, undefined, function (error) {
        console.error(`Lỗi tải model ${modelUrl}:`, error);
        container.innerHTML = `<p style="color:red; text-align:center; padding-top: 20px;">Không thể tải mô hình 3D: ${modelUrl}</p>`;
    });

    // Xử lý responsive cho renderer khi kích thước cửa sổ thay đổi
    window.addEventListener('resize', () => {
        if (activeModels[elementId] && container.clientWidth > 0 && container.clientHeight > 0) {
            activeModels[elementId].camera.aspect = container.clientWidth / container.clientHeight;
            activeModels[elementId].camera.updateProjectionMatrix();
            activeModels[elementId].renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
}

function updatePreview() {
    const model1Select = document.getElementById('modelSelect1');
    const model2Select = document.getElementById('modelSelect2');

    if (!model1Select || !model2Select) {
        console.error("Không tìm thấy một hoặc cả hai select element!");
        return;
    }

    const model1 = model1Select.value;
    const model2 = model2Select.value;

    let product1Title = '';
    let product2Title = '';
    let product1Details = '';
    let product2Details = '';
    let model1Url = '';
    let model2Url = '';

    // Dựa vào lựa chọn mẫu iPhone 1, cập nhật thông tin và đường dẫn mô hình
    if (model1 === 'iphone16ProMax') {
        product1Title = 'iPhone 16 Pro Max';
        product1Details = 'Chip: A17 Pro, Màn hình: 6.9 inch OLED, Camera: 48MP, Pin: 4700mAh.';
       model1Url = 'images/iphone_16_pro_max.glb';  // Sửa lại: Xóa dấu / ở đầu nếu 'images' là thư mục con
    } else if (model1 === 'iphone15ProMax') {
        product1Title = 'iPhone 15 Pro Max';
        product1Details = 'Chip: A17 Pro, Màn hình: 6.7 inch OLED, Camera: 48MP, Pin: 4422mAh.';
        model1Url = 'images/apple_iphone_15_pro_max_black.glb';
    } else if (model1 === 'iphone14ProMax') {
        product1Title = 'iPhone 14 Pro Max';
        product1Details = 'Chip: A16 Bionic, Màn hình: 6.7 inch OLED, Camera: 48MP, Pin: 4323mAh.';
        model1Url = 'images/free___iphone_14_pro_max_deep_purple.glb';
    } else if (model1 === 'iphone13') {
        product1Title = 'iPhone 13';
        product1Details = 'Chip: A15 Bionic, Màn hình: 6.1 inch OLED, Camera: 12MP, Pin: 3240mAh.';
        model1Url = 'images/iphone_13_pro_max.glb'; // Giả sử tên file là thế này, bạn cần đổi cho đúng
    }

    // Dựa vào lựa chọn mẫu iPhone 2, cập nhật thông tin và đường dẫn mô hình
    if (model2 === 'iphone16ProMax') {
        product2Title = 'iPhone 16 Pro Max';
        product2Details = 'Chip: A17 Pro, Màn hình: 6.9 inch OLED, Camera: 48MP, Pin: 4700mAh.';
        model2Url = 'images/iphone_16_pro_max.glb'; // Sửa lại: Xóa dấu / ở đầu
    } else if (model2 === 'iphone15ProMax') {
        product2Title = 'iPhone 15 Pro Max';
        product2Details = 'Chip: A17 Pro, Màn hình: 6.7 inch OLED, Camera: 48MP, Pin: 4422mAh.';
        model2Url = 'images/apple_iphone_15_pro_max_black.glb';
    } else if (model2 === 'iphone14ProMax') {
        product2Title = 'iPhone 14 Pro Max';
        product2Details = 'Chip: A16 Bionic, Màn hình: 6.7 inch OLED, Camera: 48MP, Pin: 4323mAh.';
        model2Url = 'images/free___iphone_14_pro_max_deep_purple.glb';
    } else if (model2 === 'iphone13') {
        product2Title = 'iPhone 13';
        product2Details = 'Chip: A15 Bionic, Màn hình: 6.1 inch OLED, Camera: 12MP, Pin: 3240mAh.';
        model2Url = 'images/iphone_13_pro_max.glb'; // Giả sử tên file là thế này
    }

    document.getElementById('iphone1Title').textContent = product1Title;
    document.getElementById('iphone1Details').textContent = product1Details;
    const iphone1ModelElement = document.getElementById('iphone1Model');
    if (iphone1ModelElement && model1Url) {
        loadModel('iphone1Model', model1Url);
    } else if (iphone1ModelElement && !model1Url) {
         iphone1ModelElement.innerHTML = '<p style="text-align:center; padding-top: 20px;">Vui lòng chọn model hợp lệ.</p>';
    } else if (!iphone1ModelElement) {
        console.error("Không tìm thấy phần tử với ID 'iphone1Model'");
    }

    document.getElementById('iphone2Title').textContent = product2Title;
    document.getElementById('iphone2Details').textContent = product2Details;
    const iphone2ModelElement = document.getElementById('iphone2Model');
    if (iphone2ModelElement && model2Url) {
        loadModel('iphone2Model', model2Url);
    } else if (iphone2ModelElement && !model2Url) {
        if(iphone2ModelElement) iphone2ModelElement.innerHTML = '<p style="text-align:center; padding-top: 20px;">Vui lòng chọn model hợp lệ.</p>';
    } else if (!iphone2ModelElement) {
        console.error("Không tìm thấy phần tử với ID 'iphone2Model'");
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("Sự kiện DOMContentLoaded đã kích hoạt.");
    if (THREE) {
        console.log("THREE đã được tải tại DOMContentLoaded.");
        if (THREE.GLTFLoader) {
            console.log("THREE.GLTFLoader đã sẵn sàng tại DOMContentLoaded.");
        } else {
            console.warn("CẢNH BÁO: THREE.GLTFLoader CHƯA sẵn sàng tại DOMContentLoaded.");
        }
        if (THREE.OrbitControls) {
            console.log("THREE.OrbitControls đã sẵn sàng tại DOMContentLoaded.");
        } else {
            console.warn("CẢNH BÁO: THREE.OrbitControls CHƯA sẵn sàng tại DOMContentLoaded.");
        }
    } else {
        console.error("LỖI: THREE CHƯA được tải tại DOMContentLoaded.");
    }

    // Không cần setTimeout nữa nếu các script CDN đã tải đúng cách
    // setTimeout(function() {
    //     console.log("Đang gọi updatePreview...");
    //     updatePreview();
    // }, 1000); 
    updatePreview(); // Gọi trực tiếp sau khi DOM đã sẵn sàng
});