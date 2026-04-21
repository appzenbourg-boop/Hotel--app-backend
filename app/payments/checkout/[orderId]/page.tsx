'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

export default function RazorpayCheckout() {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [orderDetails, setOrderDetails] = useState<any>(null)

    useEffect(() => {
        const pathParts = window.location.pathname.split('/')
        const orderId = pathParts[pathParts.length - 1]

        const searchParams = new URLSearchParams(window.location.search)
        const key = searchParams.get('key')
        const amount = searchParams.get('amount')
        const name = searchParams.get('name') || 'Guest'
        const email = searchParams.get('email') || ''
        const contact = searchParams.get('contact') || ''

        // successUrl and cancelUrl are passed from the app — they contain the correct
        // deep link scheme for the current environment (exp:// in Expo Go, hotel:// in standalone)
        const successUrl = searchParams.get('successUrl')
        const cancelUrl = searchParams.get('cancelUrl')

        if (!key || !amount || !orderId) {
            setError('Missing payment details')
            setLoading(false)
            return
        }

        setOrderDetails({ key, amount, name, email, contact, orderId, successUrl, cancelUrl })
    }, [])

    useEffect(() => {
        if (!loading && orderDetails && (window as any).Razorpay) {
            handlePayment()
        }
    }, [loading, orderDetails])

    const handlePayment = () => {
        if (!(window as any).Razorpay || !orderDetails) return

        const { successUrl, cancelUrl, orderId } = orderDetails

        // Build redirect URLs — use what the app passed, or fall back to hotel:// scheme
        const onSuccess = (response: any) => {
            const params =
                `?razorpay_payment_id=${response.razorpay_payment_id}` +
                `&razorpay_order_id=${response.razorpay_order_id}` +
                `&razorpay_signature=${response.razorpay_signature}`

            if (successUrl) {
                // successUrl already contains the base (e.g. exp://192.168.29.72:8081/--/payment-result)
                window.location.href = decodeURIComponent(successUrl) + params
            } else {
                window.location.href = `hotel://payment-result${params}`
            }
        }

        const onDismiss = () => {
            if (cancelUrl) {
                window.location.href = decodeURIComponent(cancelUrl)
            } else {
                window.location.href = 'hotel://payment-cancelled'
            }
        }

        const options = {
            key: orderDetails.key,
            amount: parseInt(orderDetails.amount, 10),
            currency: 'INR',
            name: 'Zenbourg Hospitality',
            description: 'Room Booking',
            order_id: orderId,
            handler: onSuccess,
            prefill: {
                name: orderDetails.name,
                email: orderDetails.email,
                contact: orderDetails.contact,
            },
            theme: { color: '#2F2E2E' },
            modal: { ondismiss: onDismiss }
        }

        const rzp = new (window as any).Razorpay(options)
        rzp.open()
    }

    if (error) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#fff', padding: '32px' }}>
            <div style={{ padding: '24px', backgroundColor: '#fef2f2', borderRadius: '16px', textAlign: 'center' }}>
                <p style={{ color: '#ef4444', fontWeight: '500' }}>{error}</p>
                <button onClick={() => window.location.reload()} style={{ marginTop: '16px', fontSize: '14px', color: '#dc2626', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Try again
                </button>
            </div>
        </div>
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#fff' }}>
            <Script
                src="https://checkout.razorpay.com/v1/checkout.js"
                onLoad={() => setLoading(false)}
            />

            <div style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{
                    width: '64px', height: '64px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #2F2E2E',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 24px'
                }} />
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#2F2E2E', marginBottom: '8px' }}>
                    Securing Session
                </h1>
                <p style={{ color: '#666', maxWidth: '280px', margin: '0 auto' }}>
                    Redirecting you to our secure payment partner...
                </p>

                {!loading && orderDetails && (
                    <button
                        onClick={handlePayment}
                        style={{
                            marginTop: '32px', padding: '12px 32px',
                            fontWeight: '600', color: '#fff',
                            backgroundColor: '#2F2E2E',
                            borderRadius: '999px', border: 'none', cursor: 'pointer'
                        }}
                    >
                        Click if not redirected
                    </button>
                )}
            </div>

            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
