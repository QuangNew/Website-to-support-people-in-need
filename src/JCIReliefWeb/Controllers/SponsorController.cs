using Microsoft.AspNetCore.Mvc;

namespace JCIReliefWeb.Controllers
{
    public class SponsorController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Muốn quyên góp";
            return View();
        }

        public IActionResult History()
        {
            ViewData["Title"] = "Lịch sử quyên góp";
            return View();
        }
    }
}
