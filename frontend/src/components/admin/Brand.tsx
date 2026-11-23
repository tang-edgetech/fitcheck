export default function Brand({ sub = "Admin" }: { sub?: string }) {
  return (
    <span className="brand inline-flex items-center gap-2.5 whitespace-nowrap">
      <span aria-hidden className="brand-logo grid h-7 w-7 place-items-center rounded-lg bg-[#2f5bea]">
        <span className="brand-logo-mark h-3.5 w-2 rounded-[3px] border-2 border-solid border-white" />
      </span>
      <span className="brand-name text-[16px] font-bold tracking-tight">Fitcheck <span className="brand-sub font-medium text-[#5c6978]">{sub}</span></span>
    </span>
  );
}
