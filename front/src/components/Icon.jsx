const paths = {
  book: 'M4 5.5C7 4.5 9 5 12 7c3-2 5-2.5 8-1.5v14c-3-1-5-.5-8 1.5-3-2-5-2.5-8-1.5zM12 7v14',
  plus: 'M12 5v14M5 12h14',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  arrow: 'M19 12H5m6-6-6 6 6 6',
  edit: 'm16 3 5 5-12 12-6 1 1-6zM14 5l5 5',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  down: 'm6 9 6 6 6-6',
  logout: 'M9 4H4v16h5M10 12h11m-5-5 5 5-5 5',
  chart: 'M4 20h17M7 16v-5M12 16V5M17 16V8',
  check: 'm5 12 4 4L19 6',
}
export default function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.book} />
    </svg>
  )
}
