import { Redirect } from "expo-router";

// Welcome lives on the first screen ("/") now; old links land there.
export default function Welcome() {
  return <Redirect href="/" />;
}
