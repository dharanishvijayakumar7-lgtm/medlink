import { Tabs } from "expo-router";

import { tabIcon, tabScreenOptions } from "@/components/navigation";
import { useT } from "@/lib/i18n";

/** The doctor's four places: Queue, High-risk, Search, More. */
export default function DoctorTabs() {
  const { t } = useT();
  return (
    <Tabs screenOptions={tabScreenOptions("doctor")}>
      <Tabs.Screen
        name="queue"
        options={{
          title: t("tabs.queue"),
          headerTitle: t("nav.doctor.queue"),
          tabBarIcon: tabIcon("groups", "doctor"),
        }}
      />
      <Tabs.Screen
        name="high-risk"
        options={{
          title: t("tabs.highRisk"),
          headerTitle: t("nav.doctor.highRisk"),
          tabBarIcon: tabIcon("warning", "doctor"),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t("tabs.search"),
          headerTitle: t("nav.doctor.search"),
          tabBarIcon: tabIcon("search", "doctor"),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t("tabs.more"),
          tabBarIcon: tabIcon("menu", "doctor"),
        }}
      />
    </Tabs>
  );
}
