import { HomeScreen } from "@/features/home/HomeScreen";
import { WelcomeScreen } from "@/features/auth/WelcomeScreen";
import { canUseApp, usePhoneAuth } from "@/lib/auth";

// The first screen: Home for anyone who can use the app, Welcome for everyone else.
export default function Index() {
  const auth = usePhoneAuth();
  return canUseApp(auth) ? <HomeScreen /> : <WelcomeScreen />;
}
