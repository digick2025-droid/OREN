"use client";

import Link from "next/link";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/features/i18n/language-context";
import { formatDate } from "@/lib/format";
import { useUsage } from "@/hooks/use-usage";

export default function AbonnementPage() {
  const { t } = useI18n();
  const { data: usage } = useUsage();

  return (
    <div>
      <ScreenHeader title={t.sub_title} backHref="/reglages" />
      <div className="space-y-4 px-4 pt-4">
        {usage && (
          <>
            <Card className="p-5">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[#8A93A6]">
                {t.off_current}
              </div>
              <div className="mt-1 text-[20px] font-extrabold text-navy">
                {usage.plan_name}
              </div>

              <div className="mt-4">
                <div className="flex justify-between text-[13px] text-[#5A6377]">
                  <span>{t.sub_used}</span>
                  <span className="font-bold text-navy">
                    {usage.used}
                    {usage.quota !== null && usage.quota > 0
                      ? ` / ${usage.quota}`
                      : ""}
                  </span>
                </div>
                {usage.quota !== null && usage.quota > 0 ? (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#EEF0F4]">
                    <div
                      className="h-full rounded-full bg-navy transition-all"
                      style={{
                        width: `${Math.min(
                          (usage.used / usage.quota) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-[12.5px] text-[#8A93A6]">
                    {t.counter_unlimited}
                  </p>
                )}
              </div>

              {usage.period_end && (
                <p className="mt-4 text-[12.5px] text-[#8A93A6]">
                  {t.sub_renew}{" "}
                  <span className="font-semibold text-navy">
                    {formatDate(usage.period_end)}
                  </span>
                </p>
              )}
            </Card>

            {usage.quota !== null &&
              usage.quota > 0 &&
              usage.used >= usage.quota && (
                <Card className="border-coral/40 bg-[#FFF3F2] p-4 text-[13.5px] text-navy">
                  <span className="font-bold">{t.limit_notice_title}</span>{" "}
                  {t.limit_notice_sub}
                </Card>
              )}
          </>
        )}

        <Button asChild className="w-full">
          <Link href="/offres">{t.sub_change}</Link>
        </Button>
      </div>
    </div>
  );
}
