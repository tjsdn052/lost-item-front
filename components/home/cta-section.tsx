export function CtaSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-primary p-12 text-center text-on-primary shadow-[0_30px_80px_rgba(0,35,111,0.24)] md:p-20">
        <div className="relative">
          <div className="absolute right-[-5rem] top-[-5rem] h-64 w-64 rounded-full bg-primary-container/35 blur-3xl" />
          <div className="relative z-10">
            <h2 className="font-headline text-3xl font-extrabold md:text-4xl">
              찾기 요청을 남기면 계속 탐색합니다
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg text-on-primary-container">
              찾을 때까지 확인하고 알려드립니다
            </p>
            <button
              type="button"
              className="mt-10 rounded-lg bg-surface-container-lowest px-12 py-5 text-xl font-extrabold text-primary shadow-xl shadow-black/10 transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              찾기 요청하기
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
