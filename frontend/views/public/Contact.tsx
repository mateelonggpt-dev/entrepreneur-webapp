import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Mail, Phone, MapPin, MessageSquare, Building2, CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { Mascot } from "@/components/brand/Mascot";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitContactRequest, submitDemoRequest } from "@/lib/api";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const defaultForm = {
  firstName: "",
  lastName: "",
  email: "",
  company: "",
  phone: "",
  topic: "Sales / Pricing / Demo",
  message: "",
};

const Contact = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const demoMessage = t("contactPage.demoMessage", {
    defaultValue: "I would like to book a demo for my accounting workflow.",
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const topic = params.get("topic");
    const demo = params.get("demo");
    if (topic || demo) {
      setForm((previous) => ({
        ...previous,
        topic: topic || "Sales / Pricing / Demo",
        message:
          demo === "1" && !previous.message
            ? demoMessage
            : previous.message,
      }));
    }
  }, [demoMessage, location.search]);

  const handleBookDemo = () => {
    setForm((previous) => ({
      ...previous,
      topic: "Sales / Pricing / Demo",
      message: previous.message || demoMessage,
    }));
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (form.topic === "Sales / Pricing / Demo") {
        await submitDemoRequest(form);
      } else {
        await submitContactRequest(form);
      }
      setSent(true);
      toast.success(t("contactPage.submitted", { defaultValue: "Message submitted" }));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("contactPage.submitError", { defaultValue: "Unable to submit your message." })
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-2 lg:px-8">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">{t("common.contact")}</p>
          <h1 className="text-4xl font-display font-extrabold tracking-tight lg:text-5xl">
            {t("contactPage.title", { defaultValue: "Let's talk about" })}{" "}
            <span className="gradient-brand-text">
              {t("contactPage.titleAccent", { defaultValue: "accounting setup" })}
            </span>{" "}
            {t("contactPage.titleSuffix", { defaultValue: "for your business." })}
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted-foreground">
            {t("contactPage.description", {
              defaultValue:
                "Whether you're moving from spreadsheets or another tool, our team will help you migrate, set up taxes, and onboard your team.",
            })}
          </p>

          <div className="mt-10 space-y-5">
            {[
              {
                key: "email",
                icon: Mail,
                label: t("contactPage.info.emailLabel", { defaultValue: "Email" }),
                value: "hello@matteracc.co.th",
                sub: t("contactPage.info.emailSub", { defaultValue: "We reply within 24 hours" }),
              },
              {
                key: "phone",
                icon: Phone,
                label: t("contactPage.info.phoneLabel", { defaultValue: "Phone" }),
                value: "+66 2 123 4567",
                sub: t("contactPage.info.phoneSub", { defaultValue: "Mon-Fri · 9:00-18:00 ICT" }),
              },
              {
                key: "chat",
                icon: MessageSquare,
                label: t("contactPage.info.chatLabel", { defaultValue: "Live chat" }),
                value: t("contactPage.info.chatValue", { defaultValue: "Available in-app" }),
                sub: t("contactPage.info.chatSub", { defaultValue: "For paying customers" }),
              },
              {
                key: "office",
                icon: MapPin,
                label: t("contactPage.info.officeLabel", { defaultValue: "Office" }),
                value: "123 Sukhumvit Rd., Klongtoey",
                sub: t("contactPage.info.officeSub", { defaultValue: "Bangkok 10110, Thailand" }),
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.label}</p>
                    <p className="mt-0.5 font-semibold">{item.value}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <Card className="card-premium mt-10 flex items-center gap-4 border-primary/20 bg-gradient-brand-soft p-5">
            <Mascot size="sm" />
            <div>
              <p className="font-display text-sm font-bold">
                {t("contactPage.demoTitle", { defaultValue: "Want a personal demo?" })}
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("contactPage.demoDescription", {
                  defaultValue: "Get a 30-minute walkthrough tailored to your business.",
                })}
              </p>
              <Button
                size="sm"
                className="gap-1.5 border-0 bg-gradient-brand text-primary-foreground shadow-brand"
                onClick={handleBookDemo}
              >
                {t("contactPage.demoButton", { defaultValue: "Book a demo" })} <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        </div>

        <Card ref={formCardRef} className="card-premium h-fit p-7">
          {sent ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-display font-bold">
                {t("contactPage.sentTitle", { defaultValue: "Thanks, message sent." })}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                {t("contactPage.sentDescription", {
                  defaultValue:
                    "A team member will reach out within 24 hours. In the meantime, feel free to continue exploring the product.",
                })}
              </p>
              <Button
                onClick={() => {
                  setSent(false);
                  setForm(defaultForm);
                }}
                variant="outline"
                className="mt-6"
              >
                {t("contactPage.sendAnother", { defaultValue: "Send another" })}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-2xl font-display font-bold">
                  {t("contactPage.formTitle", { defaultValue: "Send us a message" })}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("contactPage.formDescription", {
                    defaultValue: "We typically reply within a business day.",
                  })}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("contactPage.firstName", { defaultValue: "First name" })}</Label>
                  <Input
                    className="mt-1.5 h-11"
                    placeholder={t("contactPage.firstNamePlaceholder", { defaultValue: "Somchai" })}
                    value={form.firstName}
                    onChange={(event) => setForm((previous) => ({ ...previous, firstName: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>{t("contactPage.lastName", { defaultValue: "Last name" })}</Label>
                  <Input
                    className="mt-1.5 h-11"
                    placeholder={t("contactPage.lastNamePlaceholder", { defaultValue: "Bunnak" })}
                    value={form.lastName}
                    onChange={(event) => setForm((previous) => ({ ...previous, lastName: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label>{t("contactPage.workEmail", { defaultValue: "Work email" })}</Label>
                <Input
                  type="email"
                  className="mt-1.5 h-11"
                  placeholder={t("contactPage.workEmailPlaceholder", { defaultValue: "you@company.co.th" })}
                  value={form.email}
                  onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("contactPage.company", { defaultValue: "Company" })}</Label>
                  <Input
                    className="mt-1.5 h-11"
                    placeholder={t("contactPage.companyPlaceholder", { defaultValue: "Your company" })}
                    value={form.company}
                    onChange={(event) => setForm((previous) => ({ ...previous, company: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>{t("contactPage.phoneOptional", { defaultValue: "Phone (optional)" })}</Label>
                  <Input
                    className="mt-1.5 h-11"
                    placeholder={t("contactPage.phonePlaceholder", { defaultValue: "+66" })}
                    value={form.phone}
                    onChange={(event) => setForm((previous) => ({ ...previous, phone: event.target.value }))}
                  />
                </div>
              </div>

              <div>
                <Label>{t("contactPage.helpWith", { defaultValue: "What can we help with?" })}</Label>
                <select
                  className="mt-1.5 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.topic}
                  onChange={(event) => setForm((previous) => ({ ...previous, topic: event.target.value }))}
                >
                  <option value="Sales / Pricing / Demo">
                    {t("contactPage.topics.salesDemo", { defaultValue: "Sales / Pricing / Demo" })}
                  </option>
                  <option value="Migration from another tool">
                    {t("contactPage.topics.migration", { defaultValue: "Migration from another tool" })}
                  </option>
                  <option value="Technical question">
                    {t("contactPage.topics.technical", { defaultValue: "Technical question" })}
                  </option>
                  <option value="Partnership">
                    {t("contactPage.topics.partnership", { defaultValue: "Partnership" })}
                  </option>
                  <option value="Other">
                    {t("contactPage.topics.other", { defaultValue: "Other" })}
                  </option>
                </select>
              </div>

              <div>
                <Label>{t("contactPage.message", { defaultValue: "Message" })}</Label>
                <Textarea
                  className="mt-1.5 min-h-[120px]"
                  placeholder={t("contactPage.messagePlaceholder", {
                    defaultValue:
                      "Tell us a little about your business and what you're hoping to achieve.",
                  })}
                  value={form.message}
                  onChange={(event) => setForm((previous) => ({ ...previous, message: event.target.value }))}
                  required
                />
              </div>

              <Button
                type="submit"
                className="flex h-11 w-full items-center gap-2 border-0 bg-gradient-brand font-semibold text-primary-foreground shadow-brand hover:opacity-95"
                disabled={submitting}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting
                  ? t("contactPage.sending", { defaultValue: "Sending..." })
                  : t("contactPage.sendMessage", { defaultValue: "Send message" })}
              </Button>

              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />{" "}
                {t("contactPage.humanReply", {
                  defaultValue: "Replies come from real humans, not bots.",
                })}
              </p>
            </form>
          )}
        </Card>
      </section>
    </PublicLayout>
  );
};

export default Contact;
