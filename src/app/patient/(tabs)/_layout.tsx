import { Tabs } from "expo-router";

import { tabIcon, tabScreenOptions } from "@/components/navigation";
import { useT } from "@/lib/i18n";

/** The patient's four places: Home, My health, Nearby care, Profile. */
export default function PatientTabs() {
  const { t } = useT();
  return (
    <Tabs screenOptions={tabScreenOptions("patient")}>
      <Tabs.Screen
        name="home"
        options={{
          title: t("tabs.home"),
          headerShown: false,
          tabBarIcon: tabIcon("home", "patient"),
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: t("tabs.health"),
          headerTitle: t("health.title"),
          tabBarIcon: tabIcon("favorite", "patient"),
        }}
      />
      <Tabs.Screen
        name="facilities"
        options={{
          title: t("tabs.nearby"),
          headerTitle: t("nav.patient.facilities"),
          tabBarIcon: tabIcon("local_hospital", "patient"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: tabIcon("person", "patient"),
        }}
      />
    </Tabs>
  );
}
