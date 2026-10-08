import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/localClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLink, setResetLink] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError(""); setResetLink("");
    try {
      const result = await api.auth.resetPasswordRequest(email);
      if (result?.reset_token) setResetLink(`${window.location.origin}/reset-password?token=${encodeURIComponent(result.reset_token)}`);
    } catch (err) { setError(err.message || "Unable to create reset link"); }
    finally { setLoading(false); }
  };
  return <AuthLayout icon={Mail} title="Reset password" subtitle="Create a local password reset link" footer={<Link to="/login" className="text-primary font-medium hover:underline"><ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in</Link>}>
    {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
    {resetLink ? <div className="space-y-4"><p className="text-sm text-foreground text-center">Reset link generated. In this standalone app there is no email service, so use the link below.</p><a href={resetLink} className="block break-all rounded-lg bg-muted p-3 text-xs text-primary underline">{resetLink}</a><Link to="/login" className="block text-center text-sm text-primary font-medium hover:underline">Back to login</Link></div> : <form onSubmit={handleSubmit} className="space-y-4"><div className="space-y-2"><Label htmlFor="email">Email address</Label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required /></div></div><Button type="submit" className="w-full h-12 font-medium" disabled={loading}>{loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating link...</> : "Create reset link"}</Button></form>}
  </AuthLayout>;
}
