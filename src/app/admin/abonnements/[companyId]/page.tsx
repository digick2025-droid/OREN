"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminChangePlan,
  useAdminCompanyDetail,
  useAdminSetSuspended,
} from "@/hooks/use-admin-companies";
import { usePlans } from "@/hooks/use-usage";
import { formatAmount, formatDate } from "@/lib/format";
import { buildWhatsAppLink } from "@/services/whatsapp";

const PAYMENT_STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "error" | "neutral"
> = {
  succeeded: "success",
  pending: "warning",
  failed: "error",
};

export default function AdminCompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = use(params);
  const { data, isLoading } = useAdminCompanyDetail(companyId);
  const { data: plans } = usePlans();
  const changePlan = useAdminChangePlan();
  const setSuspended = useAdminSetSuspended();
  const [selectedPlan, setSelectedPlan] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const {
    company,
    plan,
    subscription,
    usage_used,
    payments,
    payment_intents,
    last_sign_in_at,
  } = data;

  const applyPlanChange = () => {
    if (!selectedPlan) return;
    changePlan.mutate({ companyId, planKey: selectedPlan });
    setSelectedPlan("");
  };

  const toggleSuspend = () => {
    setSuspended.mutate({
      companyId,
      suspended: !company.suspended_at,
      reason: company.suspended_at
        ? null
        : suspendReason.trim() || "Suspendu par un administrateur",
    });
    setSuspendReason("");
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/abonnements"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} /> Abonnements
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-navy">{company.name}</h1>
          {company.suspended_at ? <Badge variant="error">Suspendu</Badge> : null}
        </div>
        <p className="text-[13.5px] text-muted-foreground">
          {company.phone ?? "—"} · Inscrite le {formatDate(company.created_at)} ·
          Dernière connexion{" "}
          {last_sign_in_at ? formatDate(last_sign_in_at) : "jamais"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Abonnement
            </h2>
            <div>
              <div className="text-lg font-bold text-navy">
                {plan?.name ?? "Gratuit"}
              </div>
              {subscription ? (
                <div className="text-[13px] text-muted-foreground">
                  Statut {subscription.status} · Renouvellement le{" "}
                  {formatDate(subscription.current_period_end)}
                </div>
              ) : null}
              <div className="mt-1 text-[13px] text-muted-foreground">
                Usage : {usage_used}
                {plan?.monthly_quota != null ? ` / ${plan.monthly_quota}` : ""}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1">
                <Select
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                >
                  <option value="">Changer d&rsquo;offre…</option>
                  {(plans ?? []).map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={!selectedPlan || changePlan.isPending}
                onClick={applyPlanChange}
              >
                Appliquer
              </Button>
            </div>

            {company.phone ? (
              <a
                href={buildWhatsAppLink(
                  company.phone,
                  `Bonjour ${company.name}, votre abonnement OREN nécessite votre attention. Contactez-nous si besoin.`,
                )}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-whatsapp hover:underline"
              >
                <MessageCircle size={15} /> Relancer par WhatsApp
              </a>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Accès au compte
            </h2>
            {company.suspended_at ? (
              <div className="space-y-3">
                <p className="text-[13.5px] text-muted-foreground">
                  Suspendu le {formatDate(company.suspended_at)}
                  {company.suspended_reason ? ` — ${company.suspended_reason}` : ""}
                </p>
                <Button
                  variant="outline"
                  disabled={setSuspended.isPending}
                  onClick={toggleSuspend}
                >
                  Réactiver le compte
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Motif de suspension (optionnel)"
                />
                <Button
                  variant="danger"
                  disabled={setSuspended.isPending}
                  onClick={toggleSuspend}
                >
                  Suspendre le compte
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Paiements confirmés
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead>Référence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableEmpty colSpan={4}>Aucun paiement confirmé.</TableEmpty>
            ) : (
              payments.map((pay) => (
                <TableRow key={pay.id}>
                  <TableCell>{formatDate(pay.created_at)}</TableCell>
                  <TableCell className="font-semibold text-navy">
                    {formatAmount(pay.amount)}
                  </TableCell>
                  <TableCell>{pay.method}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {pay.reference}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div>
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Intentions de paiement
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Référence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payment_intents.length === 0 ? (
              <TableEmpty colSpan={4}>Aucune intention de paiement.</TableEmpty>
            ) : (
              payment_intents.map((pi) => (
                <TableRow key={pi.id}>
                  <TableCell>{formatDate(pi.created_at)}</TableCell>
                  <TableCell className="font-semibold text-navy">
                    {formatAmount(pi.amount - pi.discount_fcfa)}
                    {pi.discount_fcfa > 0 ? (
                      <span className="ml-1 text-[12px] text-muted-foreground">
                        (-{formatAmount(pi.discount_fcfa)} promo)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={PAYMENT_STATUS_VARIANT[pi.status] ?? "neutral"}>
                      {pi.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {pi.reference}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
