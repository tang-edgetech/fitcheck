export default function Brand({ sub = "Admin" }: { sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap">
      <span aria-hidden className="grid h-7 w-7 place-items-center rounded-lg bg-[#2f5bea]">
        <span className="h-3.5 w-2 rounded-[3px] border-2 border-solid border-white" />
      </span>
      <span className="text-[16px] font-bold tracking-tight">Fitcheck <span className="font-medium text-[#5c6978]">{sub}</span></span>
    </span>
  );
}
