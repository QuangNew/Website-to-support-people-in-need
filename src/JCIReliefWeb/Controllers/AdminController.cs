using Microsoft.AspNetCore.Mvc;

namespace JCIReliefWeb.Controllers
{
    public class AdminController : Controller
    {
        public IActionResult Index()
        {
            ViewData["Title"] = "Quản trị hệ thống";
            return View();
        }

        public IActionResult Users()
        {
            ViewData["Title"] = "Quản lý người dùng";
            return View();
        }

        public IActionResult Campaigns()
        {
            ViewData["Title"] = "Quản lý chiến dịch";
            return View();
        }

        public IActionResult Reports()
        {
            ViewData["Title"] = "Báo cáo thống kê";
            return View();
        }
    }
}
