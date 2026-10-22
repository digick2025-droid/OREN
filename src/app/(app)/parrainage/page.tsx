"use client";

import { toast } from "sonner";
import { AlertCircle, Check, Copy, Gift, RotateCw, Share2 } from "lucide-react";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/features/i18n/language-context";
import { useReferralInfo } from "@/hooks/use-referral";
import {
  buildReferralLink,
  referralShareText,
  whatsappShareUrl,
} from "@/lib/referral";

export default function ParrainagePage() {
  const { t } = useI18n();
  const { data: info, isLoading, isError, refetch, isFetching } = useReferralInfo();

  const link = info ? buildReferralLink(window.location.origin, info.code) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(t.referral_copied);
    } catch {
      toast.error(t.toast_save_error);
    }
  };

  const share = () => {
    const text = referralShareText(link, t.referral_share_text);
    if (typeof navigator.share === "function") {
      void navigator.share({ text }).catch(() => {
        // partage annulé par l'utilisateur : rien à faire
      });
      return;
    }
    window.open(whatsappShareUrl(text), "_blank");
  };

  return (
    <div>
      <ScreenHeader title={t.referral_title} backHref="/reglages" />
      <div className="space-y-4 px-4 pt-4">
        <Card className="flex items-start gap-3 border-coral/40 bg-accent/10 p-4">
          <Gift size={22} className="mt-0.5 shrink-0 text-coral" />
          <p className="text-[13.5px] leading-relaxed text-navy">
            <span className="font-bold">{t.referral_pitch_title}</span>{" "}
            {t.referral_pitch_sub}
          </p>
        </Card>

        {/* Jamais d'écran vide : on montre le chargement, ou l'échec avec
            un moyen de réessayer, plutôt que de laisser l'utilisateur
            chercher un lien qui n'apparaîtra pas. */}
        {isLoading ? (
          <Skeleton className="h-[168px] w-full" />
        ) : isError || !info?.code ? (
          <Card className="p-5 text-center">
            <AlertCircle size={22} className="mx-auto text-coral" />
            <p className="mt-2 text-[14px] font-semibold text-navy">
              {t.referral_load_error}
            </p>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RotateCw size={16} /> {t.pay_retry}
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-5 text-center">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t.referral_your_code}
              </div>
              <div className="mt-1 select-all text-[26px] font-extrabold tracking-wider text-navy">
                {info.code}
              </div>
              <div className="mt-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t.referral_your_link}
              </div>
              <div className="mt-1 select-all break-all rounded-lg bg-muted px-3 py-2 text-[13px] font-semibold text-navy">
                {link}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => void copy()}>
                  <Copy size={16} /> {t.referral_copy}
                </Button>
                <Button variant="accent" onClick={share}>
                  <Share2 size={16} /> {t.referral_share}
                </Button>
              </div>
            </Card>

            <div className="grid grid-cols-3 gap-3 text-center">
              <Card className="p-3">
                <div className="text-[20px] font-extrabold text-navy">
                  {info.referred_count}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {t.referral_stat_invited}
                </div>
              </Card>
              <Card className="p-3">
                <div className="flex items-center justify-center gap-1 text-[20px] font-extrabold text-navy">
                  {info.rewarded_count}
                  <Check size={14} className="text-success" />
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {t.referral_stat_rewarded}
                </div>
              </Card>
              <Card className="p-3">
                <div className="text-[20px] font-extrabold text-navy">
                  {info.credits}
                </div>
                <div className="text-[11.5px] text-muted-foreground">
                  {t.referral_stat_credits}
                </div>
              </Card>
            </div>

            <p className="text-[12.5px] text-muted-foreground/70">
              {t.referral_rules}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
