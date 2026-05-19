import { RecentItemsCarousel } from "@/components/home/recent-items-carousel";
import { getRecentItems } from "@/lib/recent-items";

export async function RecentItemsSection() {
  const recentItems = await getRecentItems(30);

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex justify-center">
          <h2 className="text-center font-headline text-3xl font-extralight text-primary">
            최근 등록된 습득물
          </h2>
        </div>
        {recentItems.length > 0 ? (
          <RecentItemsCarousel items={recentItems} />
        ) : (
          <div className="mt-10 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest px-6 py-8 text-center text-on-surface-variant shadow-[0_18px_40px_rgba(0,35,111,0.06)]">
            최근 등록된 습득물을 아직 불러오지 못했어요.
          </div>
        )}
      </div>
    </section>
  );
}
