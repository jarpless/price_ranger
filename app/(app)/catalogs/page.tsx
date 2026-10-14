import { connectCatalog } from "@/app/actions";
import { CatalogTable } from "@/components/catalog-table";
import { Button, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { skusForConnector } from "@/lib/catalog";
import { CONNECTORS, connectorBySlug } from "@/lib/connectors";
import { getData } from "@/lib/store";

export const metadata = { title: "Catalog" };

export default async function CatalogsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; count?: string; slug?: string }>;
}) {
  const { notice, count, slug } = await searchParams;
  const user = await requireUser();
  const data = await getData();
  const connections = await data.listConnections(user.id);
  const hits = await data.listCatalog();
  const library = await data.listLibrary(user.id);
  const connected = new Set(connections.map((connection) => connection.slug));
  const addedName = slug ? connectorBySlug(slug)?.name : null;

  return (
    <div className="page-stack">
      <h1 className="font-serif text-4xl">Catalog</h1>
      <p className="max-w-3xl text-sm leading-relaxed text-muted">
        Sample product names you can price yourself. Connecting a catalog copies those samples into Prices. The shared list stays read-only. Your price is the column you edit.
      </p>
      {notice === "added" && addedName ? (
        <p className="rounded-2xl bg-[#e7f0ea] px-4 py-3 text-sm leading-relaxed">
          {count === "0"
            ? `${addedName} is already in your prices.`
            : `Added ${count} sample item${count === "1" ? "" : "s"} from ${addedName}. Replace the sample prices before you quote.`}
        </p>
      ) : null}
      {notice === "unavailable" ? (
        <p className="rounded-2xl bg-[#f8f1df] px-4 py-3 text-sm">That catalog is not available to import.</p>
      ) : null}
      <ul className="card-grid card-grid-3">
        {CONNECTORS.map((connector) => {
          const countForConnector = skusForConnector(connector.slug).length;
          const isConnected = connected.has(connector.slug);
          const unavailable = connector.availability === "unavailable";
          return (
            <li key={connector.slug}>
              <Card className="lift h-full space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="font-serif text-2xl">{connector.name}</h2>
                  <span className="pill">
                    {unavailable ? "No public access" : isConnected ? "In your prices" : "Sample"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{connector.summary}</p>
                <p className="text-sm leading-relaxed text-muted">{connector.access}</p>
                {unavailable ? (
                  <Button type="button" disabled>
                    Needs a trade account
                  </Button>
                ) : (
                  <form action={connectCatalog}>
                    <input type="hidden" name="slug" value={connector.slug} />
                    <Button type="submit" variant={isConnected ? "secondary" : "primary"}>
                      {isConnected ? "Add any missing samples" : `Add ${countForConnector} sample items`}
                    </Button>
                  </form>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
      <CatalogTable hits={hits} library={library} />
    </div>
  );
}
