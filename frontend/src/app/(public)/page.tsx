import Header from "@/components/layout/Header";
import Hero from "@/components/landing/Hero";
import HiveToJar from "@/components/landing/HiveToJar";
import TrustFeatures from "@/components/landing/TrustFeatures";
import ColonyMap from "@/components/landing/ColonyMap";
import ExploreRoles from "@/components/landing/ExploreRoles";
import Footer from "@/components/landing/Footer";
import ScrollBee from "@/components/landing/ScrollBee";
import FlightBeeDecor from "@/components/landing/FlightBeeDecor";

export default function LandingPage() {
  return (
    <>
      {/* <FlightBeeDecor
        side="left"
        top="4%"
        src="/images/landing/flight-bee-left.png"
      />
      <FlightBeeDecor
        side="right"
        top="8%"
        src="/images/landing/flight-bee-right.png"
      /> */}
      <ScrollBee />
      <Header />
      <main>
        <Hero />
        <HiveToJar />
        <TrustFeatures />
        <ColonyMap />
        <ExploreRoles />
      </main>
      <Footer />
    </>
  );
}
