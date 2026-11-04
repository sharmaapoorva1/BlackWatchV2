import { NotificationsTabs } from "@/components/domain/notifications/NotificationsTabs";

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationsTabs />
      {children}
    </>
  );
}
