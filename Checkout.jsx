import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/api/localClient';
import { formatCurrency } from '@/lib/billing';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/widgets';
import { CreditCard, Lock, Loader2, CheckCircle2 } from 'lucide-react';

export default function Checkout() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const billId = params.get('bill_id');
  const paymentId = params.get('payment_id');
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        if (!billId) throw new Error('Missing bill id');
        const rows = await api.entities.Bill.filter({ id: billId });
        if (!rows[0] || rows[0].customer_id !== user.id) throw new Error('Bill not found');
        setBill(rows[0]);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [billId, user?.id]);

  const pay = async () => {
    setPaying(true); setError('');
    try { await api.functions.invoke('completePayment', { bill_id: billId, payment_id: paymentId }); setDone(true); }
    catch (e) { setError(e.message); }
    finally { setPaying(false); }
  };

  if (loading) return <div className="fixed inset-0 flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (error) return <div className="min-h-screen grid place-items-center p-6"><Card className="max-w-md w-full"><p className="text-sm text-destructive">{error}</p><Button className="mt-4" onClick={() => navigate('/bills')}>Back to Bills</Button></Card></div>;
  if (done) return <div className="min-h-screen grid place-items-center p-6"><Card className="max-w-md w-full text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h1 className="mt-4 text-xl font-bold">Payment successful</h1><p className="mt-2 text-sm text-muted-foreground">Your payment has been recorded and your bill is now paid.</p><Button className="mt-5" onClick={() => navigate('/bills')}>Return to Bills</Button></Card></div>;
  const balance = Math.max(0, Number(bill.total_amount || 0) - Number(bill.amount_paid || 0));
  return <div className="min-h-screen grid place-items-center bg-muted/30 p-6"><Card className="max-w-lg w-full"><div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-blue-600" /><h1 className="text-xl font-bold">SmartPower Checkout</h1></div><div className="mt-6 rounded-2xl bg-muted/40 p-5 space-y-3"><div className="flex justify-between"><span className="text-muted-foreground">Bill</span><span className="font-medium">{bill.bill_number}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span>{user.full_name}</span></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><span>Amount due</span><span>{formatCurrency(balance)}</span></div></div><div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4 text-emerald-600" />Local secure checkout — no external payment provider required.</div><Button className="mt-6 w-full h-12" onClick={pay} disabled={paying || balance <= 0}>{paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing…</> : balance > 0 ? `Confirm Payment ${formatCurrency(balance)}` : 'Already Paid'}</Button><Button variant="outline" className="mt-2 w-full" onClick={() => navigate('/bills')}>Cancel</Button></Card></div>;
}
