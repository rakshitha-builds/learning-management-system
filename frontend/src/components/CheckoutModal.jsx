import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { FlaskConical, ShieldCheck } from 'lucide-react';
import { Button, Modal, Badge } from './ui';
import { useCheckoutMutation, useFailPaymentMutation, useSimulatePaymentMutation, useVerifyPaymentMutation } from '../app/api';
import { addToast } from '../app/uiSlice';
import { errMsg, price } from '../lib/format';

const loadRazorpay = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve();
  const s = document.createElement('script'); s.src = 'https://checkout.razorpay.com/v1/checkout.js'; s.onload = resolve; s.onerror = () => reject(new Error('Could not load Razorpay checkout'));
  document.body.appendChild(s);
});

/**
 * Card details are NEVER handled by this app:
 *  - Razorpay mode: the hosted Razorpay Checkout collects payment; we only verify the signature on the server.
 *  - Simulated mode (no keys configured): a clearly labelled test gateway with success/failure buttons.
 */
export default function CheckoutModal({ course, open, onClose, onPaid }) {
  const dispatch = useDispatch();
  const [session, setSession] = useState(null);
  const [checkout, { isLoading }] = useCheckoutMutation();
  const [verify] = useVerifyPaymentMutation(); const [fail] = useFailPaymentMutation(); const [simulate, { isLoading: simLoading }] = useSimulatePaymentMutation();

  const close = () => { setSession(null); onClose(); };
  const finish = () => { dispatch(addToast('Payment successful — you are enrolled!')); setSession(null); onPaid?.(); };

  const begin = async () => {
    try {
      const s = await checkout(course._id).unwrap();
      if (s.gateway.mode === 'razorpay') {
        await loadRazorpay();
        const rzp = new window.Razorpay({
          key: s.gateway.keyId, order_id: s.gateway.orderId, amount: s.gateway.amount, currency: s.gateway.currency, name: 'LearnSphere', description: course.title,
          handler: async (resp) => { try { await verify({ paymentId: s.payment._id, ...resp }).unwrap(); finish(); } catch (e) { dispatch(addToast(errMsg(e), 'error')); } },
          modal: { ondismiss: () => fail({ id: s.payment._id, reason: 'Checkout closed by user' }) },
          theme: { color: '#0f766e' },
        });
        rzp.on('payment.failed', (r) => fail({ id: s.payment._id, reason: r.error?.description || 'Payment failed' }));
        rzp.open();
      } else setSession(s);
    } catch (e) { dispatch(addToast(errMsg(e), 'error')); }
  };

  const simulateOutcome = async (outcome) => {
    try {
      const r = await simulate({ id: session.payment._id, outcome }).unwrap();
      if (r.payment.status === 'success') finish(); else { dispatch(addToast('Payment failed (simulated). You were not charged.', 'error')); setSession(null); }
    } catch (e) { dispatch(addToast(errMsg(e), 'error')); }
  };

  return (
    <Modal open={open} onClose={close} title="Secure checkout">
      <div className="rounded-xl bg-stone-50 p-4"><p className="text-sm text-stone-500">You are buying</p><p className="font-display text-lg font-semibold">{course.title}</p><p className="mt-1 font-display text-2xl font-semibold text-accent-ink">{price(course.price)}</p></div>
      {!session ? (
        <>
          <p className="mt-4 flex items-start gap-2 text-sm text-stone-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />Payments run in <strong>test mode</strong>. Card details are handled by the payment gateway and never stored by LearnSphere.</p>
          <Button className="mt-5 w-full" size="lg" loading={isLoading} onClick={begin}>Continue to payment</Button>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-amber-600" /><span className="font-semibold text-amber-800">Simulated test gateway</span><Badge tone="amber">no real money</Badge></div>
          <p className="mt-2 text-sm text-amber-800">Razorpay keys are not configured on the server, so this local gateway lets you test both outcomes. Add <code>RAZORPAY_KEY_ID</code>/<code>RAZORPAY_KEY_SECRET</code> to use the real Razorpay test checkout.</p>
          <div className="mt-4 grid grid-cols-2 gap-2"><Button loading={simLoading} onClick={() => simulateOutcome('success')}>Simulate success</Button><Button variant="secondary" disabled={simLoading} onClick={() => simulateOutcome('failed')}>Simulate failure</Button></div>
        </div>
      )}
    </Modal>
  );
}
