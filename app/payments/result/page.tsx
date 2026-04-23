'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ResultContent() {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const status = searchParams.get('status');
    const orderId = searchParams.get('razorpay_order_id');
    const paymentId = searchParams.get('razorpay_payment_id');
    const signature = searchParams.get('razorpay_signature');

    // Deep link back to the mobile app
    // The mobile app layout has a payment-result screen
    const deepLink = `hotel://payment-result?status=${status}&orderId=${orderId}&paymentId=${paymentId}&signature=${signature}`;
    
    // Auto redirect after 2 seconds
    const timer = setTimeout(() => {
      window.location.href = deepLink;
    }, 2000);

    return () => clearTimeout(timer);
  }, [searchParams]);

  const status = searchParams.get('status');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white rounded-2xl shadow-xl max-w-md w-full text-center">
        {status === 'success' ? (
          <>
            <div className="bg-green-100 text-green-600 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Payment Successful!</h1>
            <p className="text-gray-600 mt-2">Redirecting you back to the app...</p>
          </>
        ) : (
          <>
            <div className="bg-red-100 text-red-600 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Payment Cancelled</h1>
            <p className="text-gray-600 mt-2">Returning to the app...</p>
          </>
        )}
        
        <a 
          href={`hotel://payment-result?status=${status}`} 
          className="mt-8 inline-block px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold"
        >
          Click here if not redirected
        </a>
      </div>
    </div>
  );
}

export default function PaymentResult() {
  return (
    <Suspense fallback={<div>Processing...</div>}>
      <ResultContent />
    </Suspense>
  );
}
