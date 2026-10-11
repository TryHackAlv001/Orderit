"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

const NIGERIAN_STATES = [
  'Lagos','Abuja','Kano','Rivers','Oyo','Anambra','Enugu','Kaduna','Katsina','Borno'
];

export default function VendorSettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<any>(null);

  // form state
  const [shopName, setShopName] = useState("");
  const [shopDescription, setShopDescription] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [logoUrls, setLogoUrls] = useState<string[]>([]);
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) {
        router.push('/login');
        return;
      }

      const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
      if (!user || user.role !== 'vendor') {
        router.push('/marketplace');
        return;
      }

      const { data: profile } = await supabase.from('vendor_profiles').select('*').eq('user_id', userId).single();
      if (!profile) {
        router.push('/marketplace');
        return;
      }

      setVendor(profile);
      setShopName(profile.shop_name || '');
      setShopDescription(profile.shop_description || '');
      setLocation(profile.location || '');
      setPhone(profile.phone || '');
      setContactEmail(profile.contact_email || '');
      if (profile.logo_url) setLogoUrls([profile.logo_url]);
      if (profile.banner_url) setBannerUrls([profile.banner_url]);

      setLoading(false);
    })();
  }, [router, supabase]);

  const handleSave = async () => {
    if (!vendor) return;
    setLoading(true);
    const updates: any = {
      shop_name: shopName,
      shop_description: shopDescription,
      location,
      phone,
      contact_email: contactEmail,
      logo_url: logoUrls[0] || null,
      banner_url: bannerUrls[0] || null,
    };

    const { error } = await supabase.from('vendor_profiles').update(updates).eq('id', vendor.id);
    setLoading(false);
    if (error) {
      toast.error('Failed to save settings');
      return;
    }

    toast.success('Store settings saved');
    router.push(`/vendor/${vendor.id}/store`);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Store Settings</h1>
        <a href={`/vendor/${vendor.id}/store`} className="text-sm text-text hover:underline">Back to My Store</a>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Profile</h2>
            <div className="space-y-3">
              <label className="block text-sm font-medium">Shop name</label>
              <input value={shopName} onChange={(e) => setShopName(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              <label className="block text-sm font-medium">Shop description</label>
              <textarea value={shopDescription} onChange={(e) => setShopDescription(e.target.value)} className="w-full rounded-md border px-3 py-2" rows={4} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Location</label>
                  <select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border px-3 py-2">
                    <option value="">Select state</option>
                    {NIGERIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border px-3 py-2" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Contact email</label>
                <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full rounded-md border px-3 py-2" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Branding</h2>
            <div className="space-y-3">
              <label className="block text-sm font-medium">Logo</label>
              <ImageUpload value={logoUrls} onChange={(urls) => setLogoUrls(urls)} maxImages={1} pathPrefix={'logos/'} />

              <label className="block text-sm font-medium">Banner</label>
              <ImageUpload value={bannerUrls} onChange={(urls) => setBannerUrls(urls)} maxImages={1} pathPrefix={'banners/'} />

              <div>
                <h3 className="text-sm font-medium">Live preview</h3>
                <div className="mt-3">
                  <StorefrontHeader vendor={{ ...vendor, logo_url: logoUrls[0] || vendor.logo_url, banner_url: bannerUrls[0] || vendor.banner_url }} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Policies</h2>
            <div className="space-y-3">
              <label className="block text-sm font-medium">Return policy</label>
              <textarea className="w-full rounded-md border px-3 py-2" rows={4} />

              <label className="block text-sm font-medium">Shipping info</label>
              <textarea className="w-full rounded-md border px-3 py-2" rows={3} />

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Average preparation time (minutes)</label>
                  <input type="number" className="w-full rounded-md border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Minimum order amount (₦)</label>
                  <input type="number" className="w-full rounded-md border px-3 py-2" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </div>

        <aside className="space-y-4">
          <h3 className="text-sm font-semibold">Help</h3>
          <p className="text-sm text-muted">Update your shop details and branding. Changes will appear on your store page.</p>
        </aside>
      </div>
    </div>
  );
}
