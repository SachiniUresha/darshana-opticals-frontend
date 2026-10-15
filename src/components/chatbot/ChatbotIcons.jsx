function Icon({ children, size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function ChatIcon() {
  return (
    <Icon size={30}>
      <path d="M21 11.5a9 9 0 0 1-13.8 7.6L3 21l1.7-5.1A9 9 0 1 1 21 11.5Z" />
    </Icon>
  );
}
export function CloseIcon({ size = 24 }) {
  return (
    <Icon size={size}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}
export function SendIcon() {
  return (
    <Icon size={22}>
      <path d="m21 3-6.5 18-3.8-7.7L3 9.5 21 3ZM21 3 10.7 13.3" />
    </Icon>
  );
}
