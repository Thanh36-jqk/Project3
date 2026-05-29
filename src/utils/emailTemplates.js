'use strict';

function getFrontendUrl() {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
}

function baseLayout(accentGradient, content) {
    const year = new Date().getFullYear();
    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f0f0f5;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0f5;padding:48px 20px;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;">

        <tr>
          <td style="background:${accentGradient};border-radius:20px 20px 0 0;padding:40px 48px;text-align:center;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 14px;">
              <tr><td style="background:rgba(255,255,255,0.15);border-radius:14px;width:56px;height:56px;text-align:center;line-height:56px;font-size:28px;">&#63743;</td></tr>
            </table>
            <p style="color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0;">Apple Store</p>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:48px 48px 40px;border-radius:0 0 20px 20px;box-shadow:0 16px 56px rgba(0,0,0,0.10);">
            ${content}
          </td>
        </tr>

        <tr>
          <td style="padding:28px 20px;text-align:center;">
            <p style="color:#aeaeb2;font-size:11px;margin:0;line-height:1.8;">&copy; ${year} Apple Store Clone &nbsp;&middot;&nbsp; All rights reserved</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function primaryButton(label, url, bg) {
    const bgColor = bg || '#0071e3';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" style="padding:36px 0 12px;">
        <a href="${url}" style="display:inline-block;background:${bgColor};color:#ffffff;font-size:16px;font-weight:600;padding:16px 48px;border-radius:980px;text-decoration:none;letter-spacing:-0.3px;line-height:1;">${label}</a>
      </td></tr>
    </table>`;
}

exports.buildVerificationEmail = (name, verifyUrl) => {
    const content = `
      <h1 style="color:#1d1d1f;font-size:28px;font-weight:700;text-align:center;margin:0 0 12px;letter-spacing:-0.7px;">Xác nhận địa chỉ email</h1>
      <p style="color:#86868b;font-size:15px;text-align:center;margin:0 0 36px;line-height:1.6;">
        Chào <strong style="color:#1d1d1f;">${name}</strong>, bạn đã tạo tài khoản Apple Store.<br>
        Hãy xác nhận email để bắt đầu mua sắm.
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background:linear-gradient(135deg,#e8f4fd 0%,#f0f7ff 100%);border-radius:16px;padding:28px;text-align:center;border:1px solid #d1e8f7;">
            <div style="font-size:40px;margin-bottom:12px;">&#128231;</div>
            <p style="color:#0071e3;font-size:14px;font-weight:600;margin:0 0 4px;">Email cần được xác nhận</p>
            <p style="color:#5e5e5e;font-size:13px;margin:0;">Nhấn nút bên dưới trong vòng 24 giờ</p>
          </td>
        </tr>
      </table>

      ${primaryButton('Xác nhận email ngay', verifyUrl)}

      <p style="color:#aeaeb2;font-size:12px;text-align:center;margin:0 0 20px;line-height:1.7;">
        Liên kết có hiệu lực trong <strong style="color:#86868b;">24 giờ</strong>.<br>
        Nếu bạn không tạo tài khoản này, hãy bỏ qua email.
      </p>

      <div style="background:#f9f9fb;border-radius:10px;padding:16px 20px;">
        <p style="color:#86868b;font-size:11px;margin:0 0 4px;font-weight:600;">Nếu nút không hoạt động, sao chép đường link:</p>
        <p style="color:#0071e3;font-size:11px;margin:0;word-break:break-all;line-height:1.6;">${verifyUrl}</p>
      </div>`;

    return baseLayout('linear-gradient(160deg,#1d1d1f 0%,#3a3a3c 100%)', content);
};

exports.buildOrderConfirmationEmail = (recipientName, order) => {
    const itemRows = (order.items || []).map(item => `
      <tr>
        <td style="font-size:13px;color:#1d1d1f;padding:10px 0;border-bottom:1px solid #f5f5f7;">${item.name || 'Sản phẩm'}${item.color ? ` <span style="color:#86868b;">(${item.color})</span>` : ''}</td>
        <td style="font-size:13px;color:#86868b;padding:10px 0;border-bottom:1px solid #f5f5f7;text-align:center;">x${item.qty}</td>
        <td style="font-size:13px;color:#1d1d1f;font-weight:600;padding:10px 0;border-bottom:1px solid #f5f5f7;text-align:right;">${((item.price || 0) * (item.qty || 1)).toLocaleString('vi-VN')}&#8363;</td>
      </tr>`).join('');

    const content = `
      <div style="text-align:center;margin-bottom:32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">
          <tr><td style="background:#f0fff4;border-radius:50%;width:72px;height:72px;text-align:center;line-height:72px;font-size:30px;">&#10003;</td></tr>
        </table>
        <h1 style="color:#1d1d1f;font-size:26px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">Đặt hàng thành công!</h1>
        <p style="color:#86868b;font-size:15px;margin:0;">Xin chào <strong style="color:#1d1d1f;">${recipientName}</strong></p>
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9fb;border-radius:14px;margin-bottom:24px;">
        <tr><td style="padding:6px 20px 2px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:13px;color:#86868b;padding:10px 0;border-bottom:1px solid #f0f0f0;">Mã đơn hàng</td>
              <td style="font-size:13px;color:#1d1d1f;font-weight:600;padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;">#${order.id.slice(-8).toUpperCase()}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#86868b;padding:10px 0;border-bottom:1px solid #f0f0f0;">Phương thức</td>
              <td style="font-size:13px;color:#1d1d1f;font-weight:600;padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;">${order.paymentMethod === 'SePay' ? 'SePay (chuyển khoản QR)' : order.paymentMethod === 'VNPay' ? 'VNPay (thanh toán online)' : 'COD (thanh toán khi nhận)'}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#86868b;padding:10px 0;border-bottom:1px solid #f0f0f0;">Giao đến</td>
              <td style="font-size:13px;color:#1d1d1f;padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;">${order.recipientAddress || ''}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#86868b;padding:10px 0;">Tổng thanh toán</td>
              <td style="font-size:16px;color:#0071e3;font-weight:700;padding:10px 0;text-align:right;">${(order.finalAmount || 0).toLocaleString('vi-VN')}&#8363;</td>
            </tr>
          </table>
        </td></tr>
      </table>

      ${itemRows ? `
      <div style="margin-bottom:24px;">
        <p style="color:#1d1d1f;font-size:13px;font-weight:700;margin:0 0 10px;">Sản phẩm đã đặt</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <th style="font-size:11px;color:#aeaeb2;font-weight:500;text-align:left;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Sản phẩm</th>
            <th style="font-size:11px;color:#aeaeb2;font-weight:500;text-align:center;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">SL</th>
            <th style="font-size:11px;color:#aeaeb2;font-weight:500;text-align:right;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Giá</th>
          </tr>
          ${itemRows}
        </table>
      </div>` : ''}

      ${primaryButton('Xem đơn hàng', getFrontendUrl(), '#0071e3')}

      <p style="color:#aeaeb2;font-size:12px;text-align:center;margin:8px 0 0;">Cảm ơn bạn đã tin tưởng Apple Store!</p>`;

    return baseLayout('linear-gradient(160deg,#0071e3 0%,#42a5f5 100%)', content);
};

exports.buildCancellationEmail = (recipientName, order, reason) => {
    const itemRows = (order.items || []).map(item => `
      <tr>
        <td style="font-size:13px;color:#1d1d1f;padding:10px 0;border-bottom:1px solid #f5f5f7;">${item.name || 'Sản phẩm'}</td>
        <td style="font-size:13px;color:#86868b;padding:10px 0;border-bottom:1px solid #f5f5f7;text-align:center;">x${item.qty}</td>
        <td style="font-size:13px;color:#1d1d1f;font-weight:600;padding:10px 0;border-bottom:1px solid #f5f5f7;text-align:right;">${((item.price || 0) * (item.qty || 1)).toLocaleString('vi-VN')}&#8363;</td>
      </tr>`).join('');

    const content = `
      <div style="text-align:center;margin-bottom:32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;">
          <tr><td style="background:#fff1f0;border-radius:50%;width:72px;height:72px;text-align:center;line-height:72px;font-size:30px;">&#128683;</td></tr>
        </table>
        <h1 style="color:#1d1d1f;font-size:26px;font-weight:700;margin:0 0 8px;letter-spacing:-0.5px;">Đơn hàng đã bị hủy</h1>
        <p style="color:#86868b;font-size:15px;margin:0;">Xin chào <strong style="color:#1d1d1f;">${recipientName}</strong></p>
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f9f9fb;border-radius:14px;margin-bottom:24px;">
        <tr><td style="padding:6px 20px 2px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="font-size:13px;color:#86868b;padding:10px 0;border-bottom:1px solid #f0f0f0;">Mã đơn hàng</td>
              <td style="font-size:13px;color:#1d1d1f;font-weight:600;padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;font-family:monospace;">#${order.id.slice(-8).toUpperCase()}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#86868b;padding:10px 0;border-bottom:1px solid #f0f0f0;">Lý do hủy</td>
              <td style="font-size:13px;color:#e74c3c;font-weight:600;padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;">${reason || 'Theo yêu cầu khách hàng'}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#86868b;padding:10px 0;border-bottom:1px solid #f0f0f0;">Tổng đơn hàng</td>
              <td style="font-size:13px;color:#1d1d1f;font-weight:600;padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;">${(order.finalAmount || 0).toLocaleString('vi-VN')}&#8363;</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#86868b;padding:10px 0;">Hoàn tiền</td>
              <td style="font-size:13px;color:#27ae60;font-weight:600;padding:10px 0;text-align:right;">${order.paymentMethod === 'SePay' ? 'Trong 3–5 ngày làm việc' : order.paymentMethod === 'VNPay' ? 'Trong 3–5 ngày làm việc' : 'Không áp dụng (COD)'}</td>
            </tr>
          </table>
        </td></tr>
      </table>

      ${itemRows ? `
      <div style="margin-bottom:24px;">
        <p style="color:#1d1d1f;font-size:13px;font-weight:700;margin:0 0 10px;">Sản phẩm trong đơn</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <th style="font-size:11px;color:#aeaeb2;font-weight:500;text-align:left;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Sản phẩm</th>
            <th style="font-size:11px;color:#aeaeb2;font-weight:500;text-align:center;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">SL</th>
            <th style="font-size:11px;color:#aeaeb2;font-weight:500;text-align:right;padding-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Giá</th>
          </tr>
          ${itemRows}
        </table>
      </div>` : ''}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
        <tr>
          <td style="background:#f0fff4;border-radius:12px;border-left:4px solid #30d158;padding:14px 20px;">
            <p style="font-size:13px;color:#1d1d1f;margin:0;line-height:1.6;">
              &#10003; <strong>Kho hàng đã được hoàn trả.</strong> Điểm thưởng và voucher (nếu có) đã được khôi phục về tài khoản.
            </p>
          </td>
        </tr>
      </table>

      ${primaryButton('Tiếp tục mua sắm', getFrontendUrl(), '#1d1d1f')}

      <p style="color:#aeaeb2;font-size:12px;text-align:center;margin:8px 0 0;">Nếu cần hỗ trợ, hãy liên hệ với chúng tôi.</p>`;

    return baseLayout('linear-gradient(160deg,#c0392b 0%,#e74c3c 100%)', content);
};
