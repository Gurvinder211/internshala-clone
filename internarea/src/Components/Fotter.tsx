import { Facebook, Twitter, Instagram } from "lucide-react";
import { useTranslation } from "next-i18next/pages";

export default function Footer() {
  const { t } = useTranslation("common");
  return (
    <footer className="bg-gray-800 text-white py-12">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <FooterSection titleKey="internshipsByPlace" items={["New York", "Los Angeles", "Chicago", "San Francisco", "Miami", "Seattle"]} />
          <FooterSection titleKey="internshipsByStream" items={["About us", "Careers", "Press", "News", "Media kit", "Contact"]} />
          <FooterSection titleKey="jobPlaces" items={["Blog", "Newsletter", "Events", "Help center", "Tutorials", "Supports"]} links />
          <FooterSection titleKey="jobsByStream" items={["Startups", "Enterprise", "Government", "SaaS", "Marketplaces", "Ecommerce"]} links />
        </div>

        <hr className="my-10 border-gray-600" />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          <FooterSection titleKey="aboutUs" items={["Startups", "Enterprise"]} links />
          <FooterSection titleKey="teamDiary" items={["Startups", "Enterprise"]} links />
          <FooterSection titleKey="terms" items={["Startups", "Enterprise"]} links />
          <FooterSection titleKey="sitemap" items={["Startups"]} links />
        </div>

        <div className="mt-10 flex flex-col sm:flex-row justify-between items-center">
          <p className="flex items-center gap-2 border border-white px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-700">
            <i className="bi bi-google-play"></i> {t("footer.getAndroidApp")}
          </p>
          <div className="flex space-x-4 mt-4 sm:mt-0">
            <Facebook className="w-6 h-6 hover:text-blue-400 cursor-pointer" />
            <Twitter className="w-6 h-6 hover:text-blue-400 cursor-pointer" />
            <Instagram className="w-6 h-6 hover:text-pink-400 cursor-pointer" />
          </div>
          <p className="mt-4 sm:mt-0 text-sm text-gray-400">{t("footer.copyright")}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterSection({ titleKey, items, links }: { titleKey: string; items: string[]; links?: boolean }) {
  const { t } = useTranslation("common");
  const itemKeys: Record<string, string> = {
    "About us": "aboutUs",
    Careers: "careers",
    Press: "press",
    News: "news",
    "Media kit": "mediaKit",
    Contact: "contact",
    Blog: "blog",
    Newsletter: "newsletter",
    Events: "events",
    "Help center": "helpCenter",
    Tutorials: "tutorials",
    Supports: "supports",
    Startups: "startups",
    Enterprise: "enterprise",
    Government: "government",
    SaaS: "saas",
    Marketplaces: "marketplaces",
    Ecommerce: "ecommerce",
  };
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-300">{t(`footer.${titleKey}`)}</h3>
      <div className="flex flex-col items-start mt-4 space-y-3">
        {items.map((item:any, index:any) =>
          links ? (
            <a key={index} href="/" className="text-gray-400 hover:text-blue-400 hover:underline">
              {itemKeys[item] ? t(`footer.${itemKeys[item]}`) : item}
            </a>
          ) : (
            <p key={index} className="text-gray-400 hover:text-blue-400 hover:underline cursor-pointer">
              {itemKeys[item] ? t(`footer.${itemKeys[item]}`) : item}
            </p>
          )
        )}
      </div>
    </div>
  );
}