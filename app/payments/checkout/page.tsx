'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function CheckoutContent() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    const key = searchParams.get('key');
    const amount = searchParams.get('amount');
    const name = searchParams.get('name') || 'Hotel Guest';
    const email = searchParams.get('email') || '';
    const contact = searchParams.get('contact') || '';
    const callbackUrl = searchParams.get('callbackUrl') || '';

    if (!orderId || !key) {
      alert('Invalid payment parameters');
      return;
    }

    const loadRazorpay = () => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        const options = {
          key: key,
          amount: amount,
          currency: 'INR',
          name: 'Stay In - Hotel Booking',
          description: 'Wallet Recharge',
          order_id: orderId,
          handler: function (response: any) {
            // Redirect to callback URL with payment info
            const url = new URL(callbackUrl);
            url.searchParams.append('razorpay_order_id', response.razorpay_order_id);
            url.searchParams.append('razorpay_payment_id', response.razorpay_payment_id);
            url.searchParams.append('razorpay_signature', response.razorpay_signature);
            url.searchParams.append('status', 'success');
            window.location.href = url.toString();
          },
          prefill: {
            name: name,
            email: email,
            contact: contact,
          },
          theme: {
            color: '#2563EB',
          },
          modal: {
            ondismiss: function () {
              const url = new URL(callbackUrl);
              url.searchParams.append('status', 'cancelled');
              window.location.href = url.toString();
            },
          },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      };
      document.body.appendChild(script);
    };

    loadRazorpay();
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-2xl shadow-xl max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h1 className="text-xl font-semibold text-gray-800">Secure Checkout</h1>
        <p className="text-gray-600 mt-2">Opening Razorpay payment gateway...</p>
        <p className="text-sm text-gray-400 mt-8">Please do not close this window</p>
      </div>
    </div>
  );
}

export default function PaymentCheckout() {
  return (
    <Suspense fallback={<div>Loading checkout...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
