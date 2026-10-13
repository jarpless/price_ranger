import { InstallHelp } from "@/components/install-help";

export const metadata = { title: "Get the app" };

export default function InstallPage() {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
      <div>
        <h1 className="font-serif text-display text-balance lg:text-[2.5rem] lg:leading-[3rem]">Get the app on your phone</h1>
        <p className="mt-3 max-w-xl text-body leading-6 text-muted">
          Install Price Ranger so it opens full screen, with the pine theme color. On Android Chrome you can use the install button when the browser offers it.
        </p>
        <InstallHelp />
      </div>
    </div>
  );
}
