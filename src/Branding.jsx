import React, { useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "./auth";
import { toast } from "react-hot-toast";

export default function Branding() {
  // For main branding logo
  const [logo, setLogo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // For header logo
  const [headerLogo, setHeaderLogo] = useState(null);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const headerFileInputRef = useRef(null);

  useEffect(() => {
    getLogo();
    getHeaderLogo();
  }, []);

  async function getLogo() {
    const res = await fetchWithAuth("/api/branding/logo");
    const data = await res.json();
    setLogo(data.logo);
  }

  async function getHeaderLogo() {
    const res = await fetchWithAuth("/api/branding/header-logo");
    const data = await res.json();
    setHeaderLogo(data.logo);
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetchWithAuth("/api/branding/logo", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast.success("Logo uploaded!");
        getLogo();
      } else {
        toast.error("Logo upload failed");
      }
    } finally {
      setUploading(false);
      fileInputRef.current.value = "";
    }
  }

  async function handleHeaderLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingHeader(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetchWithAuth("/api/branding/header-logo", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        toast.success("Header logo uploaded!");
        getHeaderLogo();
      } else {
        toast.error("Header logo upload failed");
      }
    } finally {
      setUploadingHeader(false);
      headerFileInputRef.current.value = "";
    }
  }

  async function handleLogoDelete() {
    if (!window.confirm("Delete logo?")) return;
    await fetchWithAuth("/api/branding/logo", { method: "DELETE" });
    setLogo(null);
  }

  async function handleHeaderLogoDelete() {
    if (!window.confirm("Delete header logo?")) return;
    await fetchWithAuth("/api/branding/header-logo", { method: "DELETE" });
    setHeaderLogo(null);
  }

  return (
    <div className="space-y-10 max-w-2xl mx-auto mt-10">
      <section className="p-6 rounded border bg-white">
        <h2 className="font-bold mb-2 text-lg">Portal Branding Logo</h2>
        <p className="mb-4 text-sm text-gray-600">
          This logo is shown on the login screen and in the portal selection menu.
        </p>
        <div className="flex items-center space-x-6">
          {logo ? (
            <img src={logo} alt="Current Logo" className="h-16 rounded shadow" />
          ) : (
            <span className="text-gray-400">No logo uploaded</span>
          )}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleLogoUpload}
          />
          <button
            className="btn"
            disabled={uploading}
            onClick={() => fileInputRef.current.click()}
          >
            {uploading ? "Uploading..." : "Upload Logo"}
          </button>
          {logo && (
            <button
              className="btn btn-danger"
              onClick={handleLogoDelete}
            >
              Delete
            </button>
          )}
        </div>
      </section>

      <section className="p-6 rounded border bg-white">
        <h2 className="font-bold mb-2 text-lg">Header Logo</h2>
        <p className="mb-4 text-sm text-gray-600">
          This logo appears on the header of all screens after login.
        </p>
        <div className="flex items-center space-x-6">
          {headerLogo ? (
            <img src={headerLogo} alt="Header Logo" className="h-16 rounded shadow" />
          ) : (
            <span className="text-gray-400">No header logo uploaded</span>
          )}
          <input
            type="file"
            accept="image/*"
            ref={headerFileInputRef}
            className="hidden"
            onChange={handleHeaderLogoUpload}
          />
          <button
            className="btn"
            disabled={uploadingHeader}
            onClick={() => headerFileInputRef.current.click()}
          >
            {uploadingHeader ? "Uploading..." : "Upload Header Logo"}
          </button>
          {headerLogo && (
            <button
              className="btn btn-danger"
              onClick={handleHeaderLogoDelete}
            >
              Delete
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
