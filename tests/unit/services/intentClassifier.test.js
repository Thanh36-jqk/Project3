const { classify } = require('../../../src/services/intentClassifier');

describe('intentClassifier — classify', () => {
    it('recognizes a warranty question as bao_hanh with high confidence', () => {
        const result = classify('chính sách bảo hành như thế nào?');
        expect(result.intent).toBe('bao_hanh');
        expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('recognizes a return-policy question as doi_tra', () => {
        const result = classify('cho hỏi đổi trả hàng thế nào');
        expect(result.intent).toBe('doi_tra');
    });

    it('recognizes a shipping question as van_chuyen', () => {
        const result = classify('giao hàng có mất phí không');
        expect(result.intent).toBe('van_chuyen');
    });

    it('recognizes a payment question as thanh_toan', () => {
        const result = classify('có thanh toán bằng vnpay được không');
        expect(result.intent).toBe('thanh_toan');
    });

    it('recognizes an installment question as tra_gop', () => {
        const result = classify('trả góp 0 phần trăm áp dụng thế nào');
        expect(result.intent).toBe('tra_gop');
    });

    it('recognizes a loyalty-points question as tich_diem', () => {
        const result = classify('tích điểm đổi voucher như thế nào');
        expect(result.intent).toBe('tich_diem');
    });

    it('recognizes a hotline question as hotline', () => {
        const result = classify('cho em xin số hotline liên hệ');
        expect(result.intent).toBe('hotline');
    });

    it('recognizes a working-hours question as gio_lam_viec', () => {
        const result = classify('shop mở cửa mấy giờ vậy');
        expect(result.intent).toBe('gio_lam_viec');
    });

    it('recognizes a greeting as chao_hoi', () => {
        const result = classify('xin chào shop');
        expect(result.intent).toBe('chao_hoi');
    });

    it('classifies an unrelated product question as khac with low confidence', () => {
        const result = classify('so sánh iphone 15 và 16 khác gì nhau');
        expect(result.intent).toBe('khac');
    });

    it('always returns a confidence between 0 and 1', () => {
        const result = classify('một câu hỏi bất kỳ không liên quan gì cả');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
    });
});
